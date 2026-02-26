import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { MannequinVersion } from '../entities/mannequin-version.entity';
import { TryOnRequest } from '../entities/try-on-request.entity';
import { TryOnResult } from '../entities/try-on-result.entity';
import { Subscription } from '../entities/subscription.entity';
import { CreateTryOnDto } from './dto/create-tryon.dto';

interface WaveSpeedApiEnvelope<T = unknown> {
  code?: number;
  message?: unknown;
  data?: T;
  [key: string]: unknown;
}

interface WaveSpeedPredictionData {
  id?: string;
  status?: string;
  outputs?: unknown;
  urls?: unknown;
  error?: unknown;
  message?: unknown;
  [key: string]: unknown;
}

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

interface FitProbabilityAiInput {
  category: string;
  selectedSize: string;
  measurements: TryOnMeasurements;
  inferredFitProbability: number;
  fitBreakdown: Record<string, number> | null;
}

@Injectable()
export class TryOnService {
  private readonly waveSpeedApiBaseUrl =
    process.env.WAVESPEED_API_BASE_URL ?? 'https://api.wavespeed.ai/api/v3';
  private readonly waveSpeedModelPaths = this.buildModelPathCandidates(
    process.env.WAVESPEED_TRYON_MODEL_PATH ?? process.env.WAVESPEED_MODEL_PATH,
    process.env.WAVESPEED_TRYON_MODEL_FALLBACK_PATHS ??
      process.env.WAVESPEED_MODEL_FALLBACK_PATHS,
  );
  private readonly waveSpeedFitModelPaths = this.buildModelPathCandidates(
    process.env.WAVESPEED_FIT_MODEL_PATH ?? '/wavespeed-ai/any-llm',
    process.env.WAVESPEED_FIT_MODEL_FALLBACK_PATHS,
  );
  private readonly waveSpeedFitMaxTokens = this.parsePositiveInt(
    process.env.WAVESPEED_FIT_MAX_TOKENS,
    48,
  );
  private readonly waveSpeedFitLlmModel =
    process.env.WAVESPEED_FIT_LLM_MODEL ?? 'google/gemini-2.5-flash';
  private readonly waveSpeedImageSize = this.normalizeImageSize(
    process.env.WAVESPEED_IMAGE_SIZE ?? '1024*1536',
  );
  private readonly waveSpeedPollIntervalMs = this.parsePositiveInt(
    process.env.WAVESPEED_POLL_INTERVAL_MS,
    1500,
  );
  private readonly waveSpeedTimeoutMs = this.parsePositiveInt(
    process.env.WAVESPEED_TIMEOUT_MS,
    90000,
  );

  constructor(
    @InjectRepository(TryOnRequest)
    private readonly requestRepo: Repository<TryOnRequest>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(MannequinVersion)
    private readonly mannequinRepo: Repository<MannequinVersion>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async create(userId: string, dto: CreateTryOnDto) {
    await this.ensureBillingAccount(userId);

    const mannequin = await this.mannequinRepo.findOne({
      where: { id: dto.mannequin_version_id, user_id: userId },
    });
    if (!mannequin) {
      throw new NotFoundException('Mannequin version not found');
    }

    const subscription = await this.subscriptionRepo.findOne({
      where: { user_id: userId },
    });
    if (!subscription || subscription.credits_balance < 1) {
      throw new ForbiddenException('Not enough credits. Buy 50 credits for $3 in Billing.');
    }

    const measurements: TryOnMeasurements = {
      chestCm: this.normalizeMeasurement(dto.chest_cm),
      waistCm: this.normalizeMeasurement(dto.waist_cm),
      hipsCm: this.normalizeMeasurement(dto.hips_cm),
    };

    const inference = await this.generateTryOnResult(
      mannequin.front_image_url,
      dto.garment_image,
      dto.category,
      dto.selected_size,
      measurements,
    );
    const fitProbability = await this.calculateFitProbabilityWithAi({
      category: dto.category,
      selectedSize: dto.selected_size,
      measurements,
      inferredFitProbability: inference.fitProbability,
      fitBreakdown: inference.fitBreakdown,
    });

    return this.dataSource.transaction(async (manager) => {
      const debitResult = await manager
        .createQueryBuilder()
        .update(Subscription)
        .set({ credits_balance: () => 'credits_balance - 1' })
        .where('user_id = :userId', { userId })
        .andWhere('credits_balance >= 1')
        .execute();

      if (!debitResult.affected) {
        throw new ForbiddenException('Not enough credits. Buy 50 credits for $3 in Billing.');
      }

      const request = manager.getRepository(TryOnRequest).create({
        user_id: userId,
        mannequin_version_id: dto.mannequin_version_id,
        garment_image_url: this.toStoredGarmentReference(dto.garment_image),
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

  private async ensureBillingAccount(userId: string) {
    await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(Subscription)
      .values({
        user_id: userId,
        provider: 'webkassa',
        status: 'active',
        plan_code: 'free',
        current_period_end: null,
        credits_balance: 10,
      })
      .orIgnore()
      .execute();
  }

  private async generateTryOnResult(
    mannequinFrontImageUrl: string,
    garmentImage: string,
    category: string,
    selectedSize: string,
    measurements: TryOnMeasurements,
  ): Promise<TryOnInferenceResult> {
    const normalizedMannequinImage = this.normalizeWaveSpeedImageInput(
      mannequinFrontImageUrl,
      'Mannequin image',
    );
    const normalizedGarmentImage = this.normalizeWaveSpeedImageInput(
      garmentImage,
      'Garment image',
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
        if (!this.isModelMissingError(error)) {
          throw error;
        }

        lastModelError = this.extractErrorText(error);
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
        const submitPayload = await this.waveSpeedRequest<WaveSpeedApiEnvelope<WaveSpeedPredictionData>>(
          this.resolveWaveSpeedUrl(modelPath),
          {
            method: 'POST',
            body: JSON.stringify(payload),
          },
        );

        const submission = this.normalizePrediction(submitPayload);
        const immediateImage =
          this.extractImageUrl(submission.outputs) ?? this.extractImageUrl(submission.urls);

        if (this.isCompletedStatus(submission.status) && immediateImage) {
          return {
            modelPath,
            resultImageUrl: immediateImage,
            fitProbability: this.extractFitProbability(
              submission.outputs,
              category,
              selectedSize,
            ),
            fitBreakdown: this.extractFitBreakdown(submission.outputs),
          };
        }

        if (this.isFailedStatus(submission.status, submission.error ?? submission.message)) {
          throw new ServiceUnavailableException(
            `WaveSpeed try-on failed: ${this.stringifyUnknown(submission.error ?? submission.message)}`,
          );
        }

        if (!submission.id) {
          throw new ServiceUnavailableException('WaveSpeed did not return task id for try-on');
        }

        const deadline = Date.now() + this.waveSpeedTimeoutMs;
        while (Date.now() < deadline) {
          await this.sleep(this.waveSpeedPollIntervalMs);

          const resultPayload = await this.waveSpeedRequest<WaveSpeedApiEnvelope<WaveSpeedPredictionData>>(
            this.resolveWaveSpeedUrl(`/predictions/${submission.id}/result`),
            { method: 'GET' },
          );

          const result = this.normalizePrediction(resultPayload);
          const resultImageUrl = this.extractImageUrl(result.outputs) ?? this.extractImageUrl(result.urls);

          if (this.isCompletedStatus(result.status)) {
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
          }

          if (this.isFailedStatus(result.status, result.error ?? result.message)) {
            throw new ServiceUnavailableException(
              `WaveSpeed try-on failed: ${this.stringifyUnknown(result.error ?? result.message)}`,
            );
          }
        }

        throw new ServiceUnavailableException('WaveSpeed try-on generation timed out');
      } catch (error) {
        lastPayloadError = this.extractErrorText(error);
        if (!this.isPayloadSchemaError(error)) {
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
        lastModelError = this.extractErrorText(error);
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
    const payloadCandidates = this.buildFitProbabilityPayloadCandidates(modelPath, prompt);

    let lastPayloadError: string | null = null;
    for (const payload of payloadCandidates) {
      try {
        const submitPayload = await this.waveSpeedRequest<WaveSpeedApiEnvelope<WaveSpeedPredictionData>>(
          this.resolveWaveSpeedUrl(modelPath),
          {
            method: 'POST',
            body: JSON.stringify(payload),
          },
        );

        const submission = this.normalizePrediction(submitPayload);
        const immediateScore = this.extractAiFitProbability(
          submission.outputs ?? submission.urls ?? submitPayload,
        );
        if (immediateScore !== null) {
          return immediateScore;
        }

        if (this.isFailedStatus(submission.status, submission.error ?? submission.message)) {
          throw new ServiceUnavailableException(
            `WaveSpeed fit-scoring failed: ${this.stringifyUnknown(submission.error ?? submission.message)}`,
          );
        }

        if (!submission.id) {
          throw new ServiceUnavailableException('WaveSpeed fit-scoring did not return task id');
        }

        const deadline = Date.now() + this.waveSpeedTimeoutMs;
        while (Date.now() < deadline) {
          await this.sleep(this.waveSpeedPollIntervalMs);

          const resultPayload = await this.waveSpeedRequest<WaveSpeedApiEnvelope<WaveSpeedPredictionData>>(
            this.resolveWaveSpeedUrl(`/predictions/${submission.id}/result`),
            { method: 'GET' },
          );

          const result = this.normalizePrediction(resultPayload);
          const score = this.extractAiFitProbability(result.outputs ?? result.urls ?? resultPayload);
          if (score !== null) {
            return score;
          }

          if (this.isCompletedStatus(result.status)) {
            throw new ServiceUnavailableException(
              'WaveSpeed fit-scoring completed without numeric fit_probability output',
            );
          }

          if (this.isFailedStatus(result.status, result.error ?? result.message)) {
            throw new ServiceUnavailableException(
              `WaveSpeed fit-scoring failed: ${this.stringifyUnknown(result.error ?? result.message)}`,
            );
          }
        }

        throw new ServiceUnavailableException('WaveSpeed fit-scoring timed out');
      } catch (error) {
        lastPayloadError = this.extractErrorText(error);
        if (!this.isPayloadSchemaError(error)) {
          throw error;
        }
      }
    }

    throw new ServiceUnavailableException(
      `WaveSpeed fit-scoring request failed for model "${modelPath}". Last error: ${lastPayloadError ?? 'unknown'}`,
    );
  }

  private buildFitProbabilityPayloadCandidates(
    modelPath: string,
    prompt: string,
  ): Array<Record<string, unknown>> {
    const systemPrompt =
      'Return only valid JSON with one numeric field: {"fit_probability": <0-100>}.';
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ];
    const mergedPrompt = `${systemPrompt}\n${prompt}`;
    const normalizedModelPath = this.normalizeModelPathCandidate(modelPath);
    const anyLlmModelPath = this.normalizeModelPathCandidate('/wavespeed-ai/any-llm');

    if (normalizedModelPath === anyLlmModelPath) {
      return [
        {
          prompt,
          system_prompt: systemPrompt,
          model: this.waveSpeedFitLlmModel,
          temperature: 0,
          max_tokens: this.waveSpeedFitMaxTokens,
          enable_sync_mode: true,
        },
        {
          prompt: mergedPrompt,
          model: this.waveSpeedFitLlmModel,
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

  private buildFitProbabilityPrompt(input: FitProbabilityAiInput): string {
    const measurements = this.buildMeasurementsPrompt(input.measurements);
    const fitBreakdownText = input.fitBreakdown
      ? JSON.stringify(input.fitBreakdown)
      : 'not available';

    return [
      'Estimate garment fit probability for virtual try-on.',
      'Use 0 as very poor fit and 100 as excellent fit.',
      `Category: ${input.category}.`,
      `Selected size: ${input.selectedSize}.`,
      measurements || 'Body measurements were not provided.',
      `Initial model fit hint: ${input.inferredFitProbability}.`,
      `Fit breakdown hint: ${fitBreakdownText}.`,
      'Respond with JSON only and no extra text.',
    ].join(' ');
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

    const parsedTextJson = this.tryParseJson(textOutput);
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

    const numericFromText = textOutput.match(/-?\d+(\.\d+)?/);
    if (!numericFromText) {
      return null;
    }

    return this.normalizePercentScore(Number.parseFloat(numericFromText[0]));
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
      // FireRed image edit models require root `images`; keep this candidate first.
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

  private normalizeWaveSpeedImageInput(value: string, fieldName: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new BadRequestException(`${fieldName} is required`);
    }

    if (trimmed.startsWith('data:')) {
      return trimmed;
    }

    if (trimmed.startsWith('//')) {
      return `https:${trimmed}`;
    }

    const domainLikeValue = /^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed);
    if (domainLikeValue) {
      return `https://${trimmed}`;
    }

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === 'https:') {
        return parsed.toString();
      }

      if (parsed.protocol === 'http:') {
        parsed.protocol = 'https:';
        return parsed.toString();
      }
    } catch {
      // Fall through to validation error below.
    }

    throw new BadRequestException(
      `${fieldName} must be a valid HTTPS URL or a Data URI`,
    );
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
      const parsed = this.tryParseJson(value);
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

  private async waveSpeedRequest<T>(url: string, init: RequestInit): Promise<T> {
    const apiKey = process.env.WAVESPEED_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException('WAVESPEED_API_KEY is not configured');
    }

    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });

    const rawBody = await response.text();
    const parsedBody = this.tryParseJson(rawBody);

    if (!response.ok) {
      const message = this.extractErrorMessage(parsedBody) ?? `HTTP ${response.status}`;
      throw new ServiceUnavailableException(`WaveSpeed request failed: ${message}`);
    }

    if (!parsedBody || typeof parsedBody !== 'object') {
      throw new ServiceUnavailableException('WaveSpeed returned invalid JSON');
    }

    return parsedBody as T;
  }

  private normalizePrediction(payload: WaveSpeedApiEnvelope<WaveSpeedPredictionData>): WaveSpeedPredictionData {
    const root = this.asRecord(payload);
    const nestedData = this.asRecord(root?.data);
    const source = nestedData ?? root ?? {};

    const status = this.asString(source.status) ?? this.asString(root?.status) ?? undefined;
    const outputs = source.outputs ?? source.output ?? root?.outputs ?? root?.output;
    const error = source.error ?? source.message ?? root?.error ?? root?.message;
    const message = source.message ?? root?.message;

    return {
      ...source,
      id: this.asString(source.id) ?? this.asString(root?.id) ?? undefined,
      status,
      outputs,
      urls: source.urls ?? root?.urls,
      error,
      message,
    };
  }

  private resolveWaveSpeedUrl(pathOrUrl: string): string {
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
      return pathOrUrl;
    }

    const normalizedPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
    return `${this.waveSpeedApiBaseUrl}${normalizedPath}`;
  }

  private extractImageUrl(data: unknown): string | null {
    if (typeof data === 'string') {
      return data;
    }

    if (Array.isArray(data)) {
      for (const item of data) {
        const nestedUrl = this.extractImageUrl(item);
        if (nestedUrl) {
          return nestedUrl;
        }
      }
      return null;
    }

    if (!data || typeof data !== 'object') {
      return null;
    }

    const record = data as Record<string, unknown>;
    const directCandidates = [
      record.url,
      record.download_url,
      record.image_url,
      record.result_image_url,
      record.output_url,
    ];

    for (const candidate of directCandidates) {
      if (typeof candidate === 'string' && candidate) {
        return candidate;
      }
    }

    const nestedCandidates = [record.images, record.output, record.results, record.data];
    for (const nestedCandidate of nestedCandidates) {
      const nestedUrl = this.extractImageUrl(nestedCandidate);
      if (nestedUrl) {
        return nestedUrl;
      }
    }

    return null;
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

  private isCompletedStatus(status: string | undefined): boolean {
    const normalized = (status ?? '').toLowerCase();
    return normalized === 'completed' || normalized === 'success' || normalized === 'succeeded';
  }

  private isFailedStatus(status: string | undefined, error: unknown): boolean {
    const normalized = (status ?? '').toLowerCase();
    if (
      normalized === 'failed' ||
      normalized === 'error' ||
      normalized === 'cancelled' ||
      normalized === 'canceled'
    ) {
      return true;
    }

    return !normalized && Boolean(error);
  }

  private isPayloadSchemaError(error: unknown): boolean {
    const message = this.extractErrorText(error).toLowerCase();
    return (
      message.includes('validation') ||
      message.includes('invalid') ||
      message.includes('required') ||
      message.includes('missing')
    );
  }

  private tryParseJson(payload: string): unknown {
    if (!payload.trim()) {
      return null;
    }

    try {
      return JSON.parse(payload);
    } catch {
      return null;
    }
  }

  private extractErrorMessage(payload: unknown): string | null {
    if (typeof payload === 'string') {
      return payload.trim() || null;
    }

    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const record = payload as Record<string, unknown>;
    const message = record.message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }

    if (Array.isArray(message) && message.length > 0) {
      return message.map((item) => this.stringifyUnknown(item)).join(', ');
    }

    const error = record.error;
    if (typeof error === 'string' && error.trim()) {
      return error;
    }

    if (error && typeof error === 'object') {
      const nested = this.extractErrorMessage(error);
      if (nested) {
        return nested;
      }
    }

    const data = record.data;
    if (data && typeof data === 'object') {
      const nested = this.extractErrorMessage(data);
      if (nested) {
        return nested;
      }
    }

    return null;
  }

  private parsePositiveInt(rawValue: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(rawValue ?? '', 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }
    return parsed;
  }

  private buildModelPathCandidates(
    primaryPath: string | undefined,
    fallbackPaths: string | undefined,
  ): string[] {
    const envCandidates = [primaryPath, ...(fallbackPaths?.split(',') ?? [])];
    const uniqueCandidates: string[] = [];

    for (const candidate of envCandidates.map((value) => this.normalizeModelPathCandidate(value))) {
      if (!candidate) {
        continue;
      }

      if (!uniqueCandidates.includes(candidate)) {
        uniqueCandidates.push(candidate);
      }
    }

    return uniqueCandidates;
  }

  private normalizeModelPathCandidate(value: string | undefined): string | null {
    if (!value) {
      return null;
    }

    let normalized = value.trim();
    if (!normalized) {
      return null;
    }

    if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
      try {
        normalized = new URL(normalized).pathname;
      } catch {
        return normalized;
      }
    }

    normalized = normalized
      .replace(/^\/api\/v\d+\//, '/')
      .replace(/^api\/v\d+\//, '')
      .replace(/^\/+/, '');

    return normalized || null;
  }

  private normalizeImageSize(value: string): string {
    const normalized = value.trim().replace(/[xX]/g, '*');
    return normalized || '1024*1536';
  }

  private isModelMissingError(error: unknown): boolean {
    const message = this.extractErrorText(error).toLowerCase();
    return message.includes('product not found') || message.includes('model not found');
  }

  private extractErrorText(error: unknown): string {
    if (error instanceof ServiceUnavailableException) {
      const response = error.getResponse();
      if (typeof response === 'string') {
        return response;
      }

      if (response && typeof response === 'object') {
        const responseMessage = (response as Record<string, unknown>).message;
        if (typeof responseMessage === 'string') {
          return responseMessage;
        }

        if (Array.isArray(responseMessage) && responseMessage.length > 0) {
          return responseMessage.map((item) => this.stringifyUnknown(item)).join(', ');
        }
      }
    }

    if (error instanceof Error) {
      return error.message;
    }

    return this.stringifyUnknown(error);
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }

  private asString(value: unknown): string | null {
    if (typeof value === 'string' && value.trim()) {
      return value;
    }

    return null;
  }

  private stringifyUnknown(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }

    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
