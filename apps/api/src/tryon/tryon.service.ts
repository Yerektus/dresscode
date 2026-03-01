import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { TryOnRequest } from '../entities/try-on-request.entity';
import { TryOnResult } from '../entities/try-on-result.entity';
import { isDataUri } from '../storage/data-uri';
import { StorageService } from '../storage/storage.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { MannequinService } from '../mannequin/mannequin.service';
import { WaveSpeedService } from '../wavespeed/wavespeed.service';
import { parsePositiveInt, normalizeWaveSpeedImageInput, assertLegacyDataUriSize } from '../common/image-input.utils';
import { CreateTryOnDto } from './dto/create-tryon.dto';

interface TryOnInferenceResult {
  modelPath: string;
  resultImageUrl: string;
  fitProbability: number;
  fitBreakdown: Record<string, number> | null;
}

interface TryOnMeasurements {
  chestCm: number | null;
  waistCm: number | null;
  hipsCm: number | null;
}

interface ResolvedGarmentInput {
  waveSpeedInput: string;
  storedReference: string;
}

interface FitProbabilityAiInput {
  category: string;
  selectedSize: string;
  measurements: TryOnMeasurements;
  mannequinSnapshot: Record<string, unknown> | null;
  fitBreakdown: Record<string, number> | null;
}

@Injectable()
export class TryOnService {
  private readonly waveSpeedModelPaths: string[];
  private readonly waveSpeedFitModelPaths: string[];
  private readonly waveSpeedFitMaxTokens = parsePositiveInt(
    process.env.WAVESPEED_FIT_MAX_TOKENS,
    48,
  );
  private readonly waveSpeedFitLlmModel =
    process.env.WAVESPEED_FIT_LLM_MODEL ?? 'deepseek/deepseek-v3.2';
  private readonly waveSpeedImageSize = this.normalizeImageSize(
    process.env.WAVESPEED_IMAGE_SIZE ?? '1024*1536',
  );
  private readonly waveSpeedTimeoutMs = parsePositiveInt(
    process.env.WAVESPEED_TIMEOUT_MS,
    120000,
  );
  private readonly waveSpeedPollIntervalMs = parsePositiveInt(
    process.env.WAVESPEED_POLL_INTERVAL_MS,
    1500,
  );
  private readonly legacyDataUriMaxBytes = parsePositiveInt(
    process.env.LEGACY_DATA_URI_MAX_BYTES,
    6 * 1024 * 1024,
  );

  constructor(
    @InjectRepository(TryOnRequest)
    private readonly requestRepo: Repository<TryOnRequest>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly storageService: StorageService,
    private readonly subscriptionService: SubscriptionService,
    private readonly mannequinService: MannequinService,
    private readonly ws: WaveSpeedService,
  ) {
    this.waveSpeedModelPaths = this.ws.buildModelPathCandidates(
      process.env.WAVESPEED_TRYON_MODEL_PATH ?? process.env.WAVESPEED_MODEL_PATH,
      process.env.WAVESPEED_TRYON_MODEL_FALLBACK_PATHS ??
        process.env.WAVESPEED_MODEL_FALLBACK_PATHS,
    );
    this.waveSpeedFitModelPaths = this.ws.buildModelPathCandidates(
      process.env.WAVESPEED_FIT_MODEL_PATH ?? '/wavespeed-ai/any-llm',
      process.env.WAVESPEED_FIT_MODEL_FALLBACK_PATHS,
    );
  }

  async create(userId: string, dto: CreateTryOnDto) {
    await this.subscriptionService.ensureBillingAccount(userId);

    const mannequin = await this.mannequinService.findByIdAndUser(dto.mannequin_version_id, userId);
    if (!mannequin) {
      throw new NotFoundException('Mannequin version not found');
    }

    const subscription = await this.subscriptionService.findByUser(userId);
    if (!subscription || subscription.credits_balance < 1) {
      throw new ForbiddenException('Not enough credits. Buy credits in Billing.');
    }

    const measurements: TryOnMeasurements = {
      chestCm: this.normalizeMeasurement(dto.chest_cm),
      waistCm: this.normalizeMeasurement(dto.waist_cm),
      hipsCm: this.normalizeMeasurement(dto.hips_cm),
    };
    const garmentInput = await this.resolveGarmentInput(userId, dto);

    const inference = await this.generateTryOnResult(
      mannequin.front_image_url,
      garmentInput.waveSpeedInput,
      dto.category,
      dto.selected_size,
      measurements,
    );
    const fitProbability = await this.calculateFitProbabilityWithAi({
      category: dto.category,
      selectedSize: dto.selected_size,
      measurements,
      mannequinSnapshot: mannequin.snapshot_json ?? null,
      fitBreakdown: inference.fitBreakdown,
    });

    return this.dataSource.transaction(async (manager) => {
      await this.subscriptionService.debitCredit(userId, manager);

      const request = manager.getRepository(TryOnRequest).create({
        user_id: userId,
        mannequin_version_id: dto.mannequin_version_id,
        garment_image_url: garmentInput.storedReference,
        category: dto.category,
        selected_size: dto.selected_size,
        chest_cm: measurements.chestCm,
        waist_cm: measurements.waistCm,
        hips_cm: measurements.hipsCm,
      });
      await manager.getRepository(TryOnRequest).save(request);

      const result = manager.getRepository(TryOnResult).create({
        request_id: request.id,
        result_image_url: inference.resultImageUrl,
        fit_probability: fitProbability,
        fit_breakdown_json: inference.fitBreakdown,
        model_version: inference.modelPath,
      });
      await manager.getRepository(TryOnResult).save(result);

      return { request, result };
    });
  }

  async getById(userId: string, requestId: string) {
    const request = await this.requestRepo.findOne({
      where: { id: requestId, user_id: userId },
      relations: ['result'],
    });

    if (!request) {
      throw new NotFoundException('Try-on result not found');
    }

    return request;
  }

  async getHistory(userId: string) {
    return this.requestRepo.find({
      where: { user_id: userId },
      relations: ['result'],
      order: { created_at: 'DESC' },
    });
  }

  private async resolveGarmentInput(userId: string, dto: CreateTryOnDto): Promise<ResolvedGarmentInput> {
    if (dto.garment_asset_key) {
      const normalizedKey = this.storageService.validateAssetKey(
        dto.garment_asset_key,
        userId,
        'garment_image',
      );

      return {
        waveSpeedInput: await this.storageService.getObjectAsDataUri(normalizedKey),
        storedReference: this.storageService.toStoredAssetReference(normalizedKey),
      };
    }

    const legacyValue = dto.garment_image?.trim();
    if (!legacyValue) {
      throw new BadRequestException('Either garment_asset_key or garment_image is required');
    }

    const normalizedLegacyValue = normalizeWaveSpeedImageInput(legacyValue, 'Garment image', this.legacyDataUriMaxBytes);
    if (isDataUri(normalizedLegacyValue)) {
      assertLegacyDataUriSize(normalizedLegacyValue, 'Garment image', this.legacyDataUriMaxBytes);
    }

    return {
      waveSpeedInput: normalizedLegacyValue,
      storedReference: this.toStoredGarmentReference(normalizedLegacyValue),
    };
  }

  private async generateTryOnResult(
    mannequinFrontImageUrl: string,
    garmentImage: string,
    category: string,
    selectedSize: string,
    measurements: TryOnMeasurements,
  ): Promise<TryOnInferenceResult> {
    const normalizedMannequinImage = normalizeWaveSpeedImageInput(
      mannequinFrontImageUrl,
      'Mannequin image',
      this.legacyDataUriMaxBytes,
    );
    const normalizedGarmentImage = normalizeWaveSpeedImageInput(
      garmentImage,
      'Garment image',
      this.legacyDataUriMaxBytes,
    );

    if (this.waveSpeedModelPaths.length === 0) {
      throw new ServiceUnavailableException(
        'WAVESPEED_TRYON_MODEL_PATH (or WAVESPEED_MODEL_PATH) is not configured for virtual try-on',
      );
    }

    let lastModelError: string | null = null;

    for (const modelPath of this.waveSpeedModelPaths) {
      try {
        return await this.generateTryOnResultWithModel(
          modelPath,
          normalizedMannequinImage,
          normalizedGarmentImage,
          category,
          selectedSize,
          measurements,
        );
      } catch (error) {
        if (!this.ws.isModelMissingError(error) && !this.ws.isInputImageFetchError(error)) {
          throw error;
        }

        lastModelError = this.ws.extractErrorText(error);
      }
    }

    throw new ServiceUnavailableException(
      `WaveSpeed try-on failed for all configured models. Last error: ${lastModelError ?? 'unknown'}`,
    );
  }

  private async generateTryOnResultWithModel(
    modelPath: string,
    mannequinFrontImageUrl: string,
    garmentImage: string,
    category: string,
    selectedSize: string,
    measurements: TryOnMeasurements,
  ): Promise<TryOnInferenceResult> {
    const payloadCandidates = this.buildTryOnPayloadCandidates(
      mannequinFrontImageUrl,
      garmentImage,
      category,
      selectedSize,
      measurements,
    );

    let lastPayloadError: string | null = null;
    for (const payload of payloadCandidates) {
      try {
        const result = await this.ws.submitAndPoll(
          modelPath,
          payload,
          this.waveSpeedTimeoutMs,
          this.waveSpeedPollIntervalMs,
        );

        const resultImageUrl = this.ws.extractImageUrl(result.outputs) ?? this.ws.extractImageUrl(result.urls);
        if (!resultImageUrl) {
          throw new ServiceUnavailableException(
            'WaveSpeed returned completed try-on status without result image',
          );
        }

        return {
          modelPath,
          resultImageUrl,
          fitProbability: this.extractFitProbability(result.outputs, category, selectedSize),
          fitBreakdown: this.extractFitBreakdown(result.outputs),
        };
      } catch (error) {
        lastPayloadError = this.ws.extractErrorText(error);
        if (!this.ws.isPayloadSchemaError(error)) {
          throw error;
        }
      }
    }

    throw new ServiceUnavailableException(
      `WaveSpeed try-on request failed for model "${modelPath}". Last error: ${lastPayloadError ?? 'unknown'}`,
    );
  }

  private async calculateFitProbabilityWithAi(input: FitProbabilityAiInput): Promise<number> {
    if (this.waveSpeedFitModelPaths.length === 0) {
      throw new ServiceUnavailableException(
        'WAVESPEED_FIT_MODEL_PATH is not configured for fit probability scoring',
      );
    }

    let lastModelError: string | null = null;
    for (const modelPath of this.waveSpeedFitModelPaths) {
      try {
        return await this.calculateFitProbabilityWithAiModel(modelPath, input);
      } catch (error) {
        lastModelError = this.ws.extractErrorText(error);
      }
    }

    throw new ServiceUnavailableException(
      `WaveSpeed fit probability scoring failed for all configured models. Last error: ${lastModelError ?? 'unknown'}`,
    );
  }

  private async calculateFitProbabilityWithAiModel(
    modelPath: string,
    input: FitProbabilityAiInput,
  ): Promise<number> {
    const prompt = this.buildFitProbabilityPrompt(input);
    const anyLlmModelPath = this.ws.normalizeModelPathCandidate('/wavespeed-ai/any-llm');
    const isAnyLlmModel =
      this.ws.normalizeModelPathCandidate(modelPath) === anyLlmModelPath;
    const llmModelCandidates = this.buildFitLlmModelCandidates(this.waveSpeedFitLlmModel);

    let lastPayloadError: string | null = null;
    for (const llmModelCandidate of llmModelCandidates) {
      const payloadCandidates = this.buildFitProbabilityPayloadCandidates(
        modelPath,
        prompt,
        llmModelCandidate,
      );

      let tryNextLlmCandidate = false;
      for (const payload of payloadCandidates) {
        try {
          const result = await this.ws.submitAndPoll(
            modelPath,
            payload,
            this.waveSpeedTimeoutMs,
            this.waveSpeedPollIntervalMs,
          );

          const score = this.extractAiFitProbability(
            result.outputs ?? result.urls ?? result,
          );
          if (score !== null) {
            return score;
          }

          throw new ServiceUnavailableException(
            'WaveSpeed fit-scoring completed without numeric fit_probability output',
          );
        } catch (error) {
          lastPayloadError = this.ws.extractErrorText(error);
          if (this.ws.isPayloadSchemaError(error)) {
            continue;
          }
          if (isAnyLlmModel && this.ws.isModelMissingError(error)) {
            tryNextLlmCandidate = true;
            break;
          }
          throw error;
        }
      }

      if (!tryNextLlmCandidate) {
        break;
      }
    }

    throw new ServiceUnavailableException(
      `WaveSpeed fit-scoring request failed for model "${modelPath}". Last error: ${lastPayloadError ?? 'unknown'}`,
    );
  }

  private buildFitProbabilityPayloadCandidates(
    modelPath: string,
    prompt: string,
    llmModel: string,
  ): Array<Record<string, unknown>> {
    const systemPrompt =
      'You must return exactly one JSON object with one integer field: {"fit_probability": 0-100}. No markdown, no explanation, no extra keys.';
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ];
    const mergedPrompt = `${systemPrompt}\n${prompt}`;
    const normalizedModelPath = this.ws.normalizeModelPathCandidate(modelPath);
    const anyLlmModelPath = this.ws.normalizeModelPathCandidate('/wavespeed-ai/any-llm');

    if (normalizedModelPath === anyLlmModelPath) {
      return [
        {
          prompt,
          system_prompt: systemPrompt,
          model: llmModel,
          reasoning: false,
          priority: 'latency',
          temperature: 0,
          max_tokens: this.waveSpeedFitMaxTokens,
          enable_sync_mode: true,
        },
        {
          prompt: mergedPrompt,
          model: llmModel,
          reasoning: false,
          priority: 'latency',
          temperature: 0,
          max_tokens: this.waveSpeedFitMaxTokens,
          enable_sync_mode: true,
        },
      ];
    }

    return [
      {
        messages,
        temperature: 0,
        max_tokens: this.waveSpeedFitMaxTokens,
        response_format: { type: 'json_object' },
      },
      {
        messages,
        temperature: 0,
        max_new_tokens: this.waveSpeedFitMaxTokens,
      },
      {
        prompt: mergedPrompt,
        temperature: 0,
        max_tokens: this.waveSpeedFitMaxTokens,
      },
      {
        input: mergedPrompt,
        temperature: 0,
        max_tokens: this.waveSpeedFitMaxTokens,
      },
    ];
  }

  private buildFitLlmModelCandidates(primaryModel: string): string[] {
    const primary = primaryModel.trim() || 'deepseek/deepseek-v3.2';
    const candidates = [primary];
    if (primary === 'google/gemini-3-flash') {
      candidates.push('google/gemini-3-flash-preview');
    }
    if (primary === 'deepseek/deepseek-v3.2') {
      candidates.push('deepseek/deepseek-v3.2-chat');
      candidates.push('deepseek/deepseek-v3.2-exp');
    }

    const uniqueCandidates: string[] = [];
    for (const candidate of candidates) {
      if (!uniqueCandidates.includes(candidate)) {
        uniqueCandidates.push(candidate);
      }
    }

    return uniqueCandidates;
  }

  private buildFitProbabilityPrompt(input: FitProbabilityAiInput): string {
    const mannequinProfile = this.buildMannequinProfilePrompt(input.mannequinSnapshot);
    const fitBreakdownText = input.fitBreakdown
      ? JSON.stringify(input.fitBreakdown)
      : 'not available';
    const hasBodyMeasurements =
      input.measurements.chestCm !== null ||
      input.measurements.waistCm !== null ||
      input.measurements.hipsCm !== null;

    const bodyMeasurementsLine = hasBodyMeasurements
      ? `Body measurements are provided: chest ${
          input.measurements.chestCm ?? 'not provided'
        } cm, waist ${input.measurements.waistCm ?? 'not provided'} cm, hips ${
          input.measurements.hipsCm ?? 'not provided'
        } cm - use these values together with height, weight, gender, and selected size.`
      : 'Body measurements are not provided - infer only from height, weight, gender, and selected size.';

    return [
      'Estimate fit_probability (0-100) for size recommendation in virtual try-on using only the provided body profile signals and the selected size.',
      '',
      'Fit scale:',
      '0-33 = Tight',
      '34-66 = True Fit',
      '67-100 = Loose',
      '',
      `Category: ${input.category}`,
      `Selected size: ${input.selectedSize}`,
      '',
      'Mannequin profile:',
      '',
      mannequinProfile,
      '',
      `Fit breakdown signals: ${fitBreakdownText}`,
      '',
      bodyMeasurementsLine,
      '',
      'Return exactly:',
      '{"fit_probability": <integer 0..100>}',
      '',
      'No markdown. No explanation. No additional keys.',
    ].join('\n');
  }

  private buildMannequinProfilePrompt(snapshot: Record<string, unknown> | null): string {
    const source = snapshot ?? {};
    const genderRaw = this.ws.asString(source.gender)?.toLowerCase();
    const gender =
      genderRaw === 'male' || genderRaw === 'female' ? genderRaw : 'not provided';

    const height = this.normalizeProfileMeasurement(this.toFiniteNumber(source.height_cm));
    const weight = this.normalizeProfileMeasurement(this.toFiniteNumber(source.weight_kg));
    const chest = this.normalizeProfileMeasurement(this.toFiniteNumber(source.chest_cm));
    const waist = this.normalizeProfileMeasurement(this.toFiniteNumber(source.waist_cm));
    const hips = this.normalizeProfileMeasurement(this.toFiniteNumber(source.hips_cm));

    let faceReference = 'not provided';
    if (typeof source.face_image_used === 'boolean') {
      faceReference = source.face_image_used ? 'used' : 'not used';
    }

    return [
      `Gender: ${gender}`,
      '',
      `Height: ${height === null ? 'not provided' : `${Math.round(height)} cm`}`,
      '',
      `Weight: ${weight === null ? 'not provided' : `${Math.round(weight)} kg`}`,
      '',
      `Chest: ${chest === null ? 'not provided' : `${Math.round(chest)} cm`}`,
      '',
      `Waist: ${waist === null ? 'not provided' : `${Math.round(waist)} cm`}`,
      '',
      `Hips: ${hips === null ? 'not provided' : `${Math.round(hips)} cm`}`,
      '',
      `Face reference: ${faceReference}`,
    ].join('\n');
  }

  private normalizeProfileMeasurement(value: number | null): number | null {
    if (value === null || value <= 0) {
      return null;
    }

    return value;
  }

  private extractAiFitProbability(payload: unknown): number | null {
    const directNumeric = this.findFirstNumericValue(payload, [
      'fit_probability',
      'fitProbability',
      'fit_score',
      'fitScore',
    ]);
    const normalizedDirect = this.normalizePercentScore(directNumeric);
    if (normalizedDirect !== null) {
      return normalizedDirect;
    }

    const textOutput = this.extractTextOutput(payload);
    if (!textOutput) {
      return null;
    }
    const normalizedTextOutput = textOutput.toLowerCase();
    if (
      !normalizedTextOutput.includes('fit') &&
      !normalizedTextOutput.includes('score') &&
      !normalizedTextOutput.includes('{')
    ) {
      return null;
    }

    const parsedTextJson = this.ws.asRecord(this.ws.tryParseJson(textOutput)) ?? this.extractJsonObjectFromText(textOutput);
    const numericFromJson = this.findFirstNumericValue(parsedTextJson, [
      'fit_probability',
      'fitProbability',
      'fit_score',
      'fitScore',
    ]);
    const normalizedJson = this.normalizePercentScore(numericFromJson);
    if (normalizedJson !== null) {
      return normalizedJson;
    }
    return null;
  }

  private extractJsonObjectFromText(text: string): Record<string, unknown> | null {
    const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedMatch?.[1]) {
      const parsedFence = this.ws.asRecord(this.ws.tryParseJson(fencedMatch[1]));
      if (parsedFence) {
        return parsedFence;
      }
    }

    const parsedWhole = this.ws.asRecord(this.ws.tryParseJson(text));
    if (parsedWhole) {
      return parsedWhole;
    }

    let startIndex = -1;
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\' && inString) {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (inString) {
        continue;
      }

      if (char === '{') {
        if (depth === 0) {
          startIndex = index;
        }
        depth += 1;
        continue;
      }

      if (char === '}' && depth > 0) {
        depth -= 1;
        if (depth === 0 && startIndex >= 0) {
          const candidate = text.slice(startIndex, index + 1);
          const parsedCandidate = this.ws.asRecord(this.ws.tryParseJson(candidate));
          if (parsedCandidate) {
            return parsedCandidate;
          }
          startIndex = -1;
        }
      }
    }

    return null;
  }

  private buildTryOnPayloadCandidates(
    mannequinFrontImageUrl: string,
    garmentImage: string,
    category: string,
    selectedSize: string,
    measurements: TryOnMeasurements,
  ): Array<Record<string, unknown>> {
    const prompt = this.buildTryOnPrompt(category, selectedSize, measurements);
    const normalizedCategory = this.normalizeGarmentCategory(category);
    const imagesAsStrings = [mannequinFrontImageUrl, garmentImage];
    const imagesAsUrlObjects = [
      { url: mannequinFrontImageUrl },
      { url: garmentImage },
    ];
    const imagesAsImageUrlObjects = [
      { image_url: mannequinFrontImageUrl },
      { image_url: garmentImage },
    ];

    return [
      {
        prompt,
        size: this.waveSpeedImageSize,
        images: imagesAsStrings,
      },
      {
        prompt,
        size: this.waveSpeedImageSize,
        seed: -1,
        images: imagesAsStrings,
      },
      {
        prompt,
        size: this.waveSpeedImageSize,
        images: imagesAsUrlObjects,
      },
      {
        prompt,
        size: this.waveSpeedImageSize,
        images: imagesAsImageUrlObjects,
      },
      {
        prompt,
        size: this.waveSpeedImageSize,
        seed: -1,
        enable_prompt_expansion: false,
        enable_base64_output: false,
        mannequin_image: mannequinFrontImageUrl,
        garment_image: garmentImage,
        garment_category: normalizedCategory,
        garment_size: selectedSize,
      },
      {
        prompt,
        size: this.waveSpeedImageSize,
        seed: -1,
        enable_prompt_expansion: false,
        enable_base64_output: false,
        person_image: mannequinFrontImageUrl,
        cloth_image: garmentImage,
        category: normalizedCategory,
        selected_size: selectedSize,
      },
      {
        prompt,
        size: this.waveSpeedImageSize,
        seed: -1,
        enable_prompt_expansion: false,
        enable_base64_output: false,
        model_image: mannequinFrontImageUrl,
        cloth_image: garmentImage,
        garment_category: normalizedCategory,
        selected_size: selectedSize,
      },
      {
        prompt,
        size: this.waveSpeedImageSize,
        seed: -1,
        enable_prompt_expansion: false,
        enable_base64_output: false,
        input_image: mannequinFrontImageUrl,
        reference_image: garmentImage,
        garment_image: garmentImage,
        category: normalizedCategory,
        selected_size: selectedSize,
      },
    ];
  }

  private buildTryOnPrompt(
    category: string,
    selectedSize: string,
    measurements: TryOnMeasurements,
  ): string {
    const measurementsPrompt = this.buildMeasurementsPrompt(measurements);

    return [
      'Virtual clothing try-on using the provided mannequin image as the exact base.',
      'Image 1 is the mannequin base. Image 2 is the garment to apply.',
      `Garment category: ${category}.`,
      `Requested size: ${selectedSize}.`,
      measurementsPrompt,
      'Keep exact mannequin pose, camera angle, crop, body proportions, and face identity.',
      'Do not change the mannequin background or framing.',
      'Replace only clothing with the provided garment image.',
      'Apply garment naturally with realistic folds, shadows, and body alignment.',
      'Photorealistic full-body fashion result.',
      'Do not render any text, numbers, symbols, labels, measurement tables, size tags, captions, logos, or watermarks in the image.',
    ]
      .filter((line) => Boolean(line))
      .join(' ');
  }

  private buildMeasurementsPrompt(measurements: TryOnMeasurements): string {
    const parts: string[] = [];

    if (measurements.chestCm !== null) {
      parts.push(`chest ${measurements.chestCm} cm`);
    }
    if (measurements.waistCm !== null) {
      parts.push(`waist ${measurements.waistCm} cm`);
    }
    if (measurements.hipsCm !== null) {
      parts.push(`hips ${measurements.hipsCm} cm`);
    }

    if (parts.length === 0) {
      return '';
    }

    return `Body measurements for fit guidance: ${parts.join(', ')}.`;
  }

  private normalizeGarmentCategory(category: string): string {
    const normalized = category.trim().toLowerCase();
    if (normalized === 'top' || normalized === 'outerwear') {
      return 'upper_body';
    }

    if (normalized === 'bottom') {
      return 'lower_body';
    }

    if (normalized === 'dress') {
      return 'dresses';
    }

    if (normalized === 'shoes') {
      return 'shoes';
    }

    return normalized || 'upper_body';
  }

  private extractFitProbability(data: unknown, category: string, selectedSize: string): number {
    const directScoreRaw = this.findFirstNumericValue(data, [
      'fit_probability',
      'fitProbability',
      'fit_score',
      'fitScore',
      'confidence',
      'score',
    ]);
    const directScore = this.normalizePercentScore(directScoreRaw);
    const breakdownScore = this.estimateBreakdownScore(this.extractFitBreakdown(data), category);
    const sizePrior = this.getSizePriorScore(selectedSize);

    let blended: number;
    if (directScore !== null && breakdownScore !== null) {
      blended = directScore * 0.65 + breakdownScore * 0.3 + sizePrior * 0.05;
    } else if (directScore !== null) {
      blended = directScore * 0.9 + sizePrior * 0.1;
    } else if (breakdownScore !== null) {
      blended = breakdownScore * 0.85 + sizePrior * 0.15;
    } else {
      blended = sizePrior;
    }

    return this.clampPercent(Math.round(blended));
  }

  private extractFitBreakdown(data: unknown): Record<string, number> | null {
    const directBreakdown = this.extractBreakdownObject(data);
    if (directBreakdown) {
      return directBreakdown;
    }

    if (!data || typeof data !== 'object') {
      return null;
    }

    const record = data as Record<string, unknown>;
    const nestedCandidates = [
      record.fit_breakdown_json,
      record.fit_breakdown,
      record.breakdown,
      record.measurements,
      record.data,
    ];

    for (const nested of nestedCandidates) {
      const nestedBreakdown = this.extractBreakdownObject(nested);
      if (nestedBreakdown) {
        return nestedBreakdown;
      }
    }

    return null;
  }

  private extractBreakdownObject(value: unknown): Record<string, number> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const allowedKeys = ['shoulders', 'chest', 'waist', 'hips', 'length', 'sleeves'];
    const record = value as Record<string, unknown>;
    const breakdown: Record<string, number> = {};

    for (const key of allowedKeys) {
      const numeric = this.normalizePercentScore(record[key]);
      if (numeric === null) {
        continue;
      }

      breakdown[key] = numeric;
    }

    return Object.keys(breakdown).length > 0 ? breakdown : null;
  }

  private estimateBreakdownScore(
    breakdown: Record<string, number> | null,
    category: string,
  ): number | null {
    if (!breakdown) {
      return null;
    }

    const normalizedCategory = this.normalizeGarmentCategory(category);
    const categoryWeights: Record<string, Record<string, number>> = {
      upper_body: {
        shoulders: 0.28,
        chest: 0.34,
        waist: 0.18,
        sleeves: 0.2,
      },
      lower_body: {
        waist: 0.35,
        hips: 0.4,
        length: 0.25,
      },
      dresses: {
        chest: 0.25,
        waist: 0.3,
        hips: 0.25,
        length: 0.2,
      },
      shoes: {
        length: 1,
      },
    };

    const weights = categoryWeights[normalizedCategory];
    if (!weights) {
      const values = Object.values(breakdown);
      if (values.length === 0) {
        return null;
      }
      return this.clampPercent(Math.round(values.reduce((sum, value) => sum + value, 0) / values.length));
    }

    let weightedSum = 0;
    let totalWeight = 0;
    for (const [key, weight] of Object.entries(weights)) {
      const metric = this.normalizePercentScore(breakdown[key]);
      if (metric === null) {
        continue;
      }

      weightedSum += metric * weight;
      totalWeight += weight;
    }

    if (totalWeight <= 0) {
      const values = Object.values(breakdown);
      if (values.length === 0) {
        return null;
      }
      return this.clampPercent(Math.round(values.reduce((sum, value) => sum + value, 0) / values.length));
    }

    return this.clampPercent(Math.round(weightedSum / totalWeight));
  }

  private getSizePriorScore(selectedSize: string): number {
    const normalizedSize = selectedSize.trim().toUpperCase();
    const sizePrior: Record<string, number> = {
      XS: 72,
      S: 78,
      M: 84,
      L: 80,
      XL: 75,
      XXL: 70,
    };

    return sizePrior[normalizedSize] ?? 76;
  }

  private normalizePercentScore(value: unknown): number | null {
    const parsed = this.toFiniteNumber(value);
    if (parsed === null || parsed < 0) {
      return null;
    }

    const normalized = parsed <= 1 ? parsed * 100 : parsed;
    if (!Number.isFinite(normalized)) {
      return null;
    }

    return this.clampPercent(Math.round(normalized));
  }

  private clampPercent(value: number): number {
    return Math.max(0, Math.min(100, value));
  }

  private normalizeMeasurement(value: number | undefined): number | null {
    if (!Number.isFinite(value)) {
      return null;
    }

    const numeric = Number(value);
    if (numeric <= 0) {
      return null;
    }

    return Math.round(numeric * 10) / 10;
  }

  private findFirstNumericValue(
    value: unknown,
    preferredKeys: string[],
    depth = 0,
  ): number | null {
    if (depth > 4 || value === null || value === undefined) {
      return null;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const nested = this.findFirstNumericValue(item, preferredKeys, depth + 1);
        if (nested !== null) {
          return nested;
        }
      }
      return null;
    }

    if (typeof value === 'string') {
      const parsed = this.ws.tryParseJson(value);
      if (parsed !== null) {
        return this.findFirstNumericValue(parsed, preferredKeys, depth + 1);
      }
      return null;
    }

    if (typeof value !== 'object') {
      return null;
    }

    const record = value as Record<string, unknown>;
    for (const key of preferredKeys) {
      const keyedValue = record[key];
      const keyedNumeric = this.toFiniteNumber(keyedValue);
      if (keyedNumeric !== null) {
        return keyedNumeric;
      }

      const nested = this.findFirstNumericValue(keyedValue, preferredKeys, depth + 1);
      if (nested !== null) {
        return nested;
      }
    }

    for (const nestedValue of Object.values(record)) {
      const nested = this.findFirstNumericValue(nestedValue, preferredKeys, depth + 1);
      if (nested !== null) {
        return nested;
      }
    }

    return null;
  }

  private toFiniteNumber(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private toStoredGarmentReference(value: string): string {
    if (value.startsWith('data:')) {
      return 'inline-data-uri';
    }

    const maxLength = 240;
    if (value.length <= maxLength) {
      return value;
    }

    return `${value.slice(0, maxLength - 3)}...`;
  }

  private extractTextOutput(data: unknown): string | null {
    if (typeof data === 'string') {
      const trimmed = data.trim();
      return trimmed ? trimmed : null;
    }

    if (Array.isArray(data)) {
      for (const item of data) {
        const nestedText = this.extractTextOutput(item);
        if (nestedText) {
          return nestedText;
        }
      }

      return null;
    }

    if (!data || typeof data !== 'object') {
      return null;
    }

    const record = data as Record<string, unknown>;
    const directCandidates = [
      record.text,
      record.output_text,
      record.generated_text,
      record.content,
      record.response,
      record.message,
    ];

    for (const candidate of directCandidates) {
      const extracted = this.extractTextOutput(candidate);
      if (extracted) {
        return extracted;
      }
    }

    const nestedCandidates = [record.choices, record.outputs, record.output, record.data, record.results];
    for (const nestedCandidate of nestedCandidates) {
      const extracted = this.extractTextOutput(nestedCandidate);
      if (extracted) {
        return extracted;
      }
    }

    return null;
  }

  private normalizeImageSize(value: string): string {
    const normalized = value.trim().replace(/[xX]/g, '*');
    return normalized || '1024*1536';
  }
}
