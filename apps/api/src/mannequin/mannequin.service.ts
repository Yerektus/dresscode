import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MannequinVersion } from '../entities/mannequin-version.entity';
import { BodyProfile } from '../entities/body-profile.entity';
import { estimateDataUriBytes, isDataUri } from '../storage/data-uri';
import { StorageService } from '../storage/storage.service';

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

@Injectable()
export class MannequinService {
  private readonly waveSpeedApiBaseUrl =
    process.env.WAVESPEED_API_BASE_URL ?? 'https://api.wavespeed.ai/api/v3';
  private readonly waveSpeedModelPaths = this.buildModelPathCandidates(
    process.env.WAVESPEED_MODEL_PATH,
    process.env.WAVESPEED_MODEL_FALLBACK_PATHS,
  );
  private readonly waveSpeedFaceModelPaths = this.buildModelPathCandidates(
    process.env.WAVESPEED_MANNEQUIN_FACE_MODEL_PATH,
    process.env.WAVESPEED_MANNEQUIN_FACE_MODEL_FALLBACK_PATHS,
    [],
  );
  private readonly waveSpeedImageSize = this.normalizeImageSize(
    process.env.WAVESPEED_IMAGE_SIZE ?? '1024*1536',
  );
  private readonly waveSpeedImageAspectRatio = this.resolveAspectRatioFromImageSize(
    this.waveSpeedImageSize,
  );
  private readonly waveSpeedPollIntervalMs = this.parsePositiveInt(
    process.env.WAVESPEED_POLL_INTERVAL_MS,
    1500,
  );
  private readonly waveSpeedTimeoutMs = this.parsePositiveInt(
    process.env.WAVESPEED_TIMEOUT_MS,
    90000,
  );
  private readonly legacyDataUriMaxBytes = this.parsePositiveInt(
    process.env.LEGACY_DATA_URI_MAX_BYTES,
    6 * 1024 * 1024,
  );

  constructor(
    @InjectRepository(MannequinVersion)
    private readonly repo: Repository<MannequinVersion>,
    @InjectRepository(BodyProfile)
    private readonly bodyProfileRepo: Repository<BodyProfile>,
    private readonly storageService: StorageService,
  ) {}

  async getActive(userId: string) {
    const mannequin = await this.repo.findOne({
      where: { user_id: userId, is_active: true },
    });
    if (!mannequin) throw new NotFoundException('No active mannequin');
    return mannequin;
  }

  async generate(userId: string) {
    const profile = await this.bodyProfileRepo.findOne({ where: { user_id: userId } });
    if (!profile) throw new NotFoundException('Body profile not found. Complete onboarding first.');

    const faceImageInput = await this.resolveFaceImageInput(userId, profile.face_image);
    const generatedImageUrl = faceImageInput
      ? await this.generateMannequinImageWithFace(profile, faceImageInput)
      : await this.generateMannequinImage(profile);

    // Deactivate previous versions
    await this.repo.update({ user_id: userId, is_active: true }, { is_active: false });

    const version = this.repo.create({
      user_id: userId,
      snapshot_json: {
        height_cm: profile.height_cm,
        weight_kg: profile.weight_kg,
        chest_cm: profile.chest_cm,
        waist_cm: profile.waist_cm,
        hips_cm: profile.hips_cm,
        gender: profile.gender,
        face_image_used: Boolean(faceImageInput),
      },
      front_image_url: generatedImageUrl,
      side_image_url: null,
      is_active: true,
    });

    return this.repo.save(version);
  }

  private async resolveFaceImageInput(userId: string, value: string | null): Promise<string | null> {
    if (!value) {
      return null;
    }

    const assetKey = this.storageService.extractAssetKeyFromReference(value);
    if (assetKey) {
      const normalizedKey = this.storageService.validateAssetKey(assetKey, userId, 'face_image');
      // Fetch the image server-side and return as base64 data URI so that
      // external services like WaveSpeed (which cannot reach localhost) can
      // receive the image content inline rather than via a private S3 URL.
      return this.storageService.getObjectAsDataUri(normalizedKey);
    }

    return this.normalizeWaveSpeedImageInput(value, 'Face image');
  }

  private async generateMannequinImage(profile: BodyProfile): Promise<string> {
    let lastModelError: string | null = null;

    for (const modelPath of this.waveSpeedModelPaths) {
      try {
        return await this.generateMannequinImageWithModel(profile, modelPath);
      } catch (error) {
        if (!this.isModelMissingError(error)) {
          throw error;
        }

        lastModelError = this.extractErrorText(error);
      }
    }

    throw new ServiceUnavailableException(
      `WaveSpeed request failed for all configured models. Last error: ${lastModelError ?? 'unknown'}`,
    );
  }

  private async generateMannequinImageWithFace(
    profile: BodyProfile,
    faceImage: string,
  ): Promise<string> {
    if (this.waveSpeedFaceModelPaths.length === 0) {
      throw new ServiceUnavailableException(
        'WAVESPEED_MANNEQUIN_FACE_MODEL_PATH is required when face image is provided',
      );
    }

    let lastModelError: string | null = null;
    for (const modelPath of this.waveSpeedFaceModelPaths) {
      try {
        return await this.generateMannequinImageWithFaceModel(profile, faceImage, modelPath);
      } catch (error) {
        if (!this.isModelMissingError(error)) {
          throw error;
        }

        lastModelError = this.extractErrorText(error);
      }
    }

    throw new ServiceUnavailableException(
      `WaveSpeed face-aware mannequin generation failed for all configured models. Last error: ${lastModelError ?? 'unknown'}`,
    );
  }

  private async generateMannequinImageWithModel(
    profile: BodyProfile,
    modelPath: string,
  ): Promise<string> {
    return this.runMannequinGeneration(modelPath, {
      prompt: this.buildCinematicPrompt(profile),
      size: this.waveSpeedImageSize,
      seed: -1,
      enable_prompt_expansion: true,
      enable_base64_output: false,
    });
  }

  private async generateMannequinImageWithFaceModel(
    profile: BodyProfile,
    faceImage: string,
    modelPath: string,
  ): Promise<string> {
    const payloadCandidates = this.buildFacePayloadCandidates(profile, faceImage);
    let lastPayloadError: string | null = null;

    for (const payload of payloadCandidates) {
      try {
        return await this.runMannequinGeneration(modelPath, payload);
      } catch (error) {
        lastPayloadError = this.extractErrorText(error);
        if (!this.isPayloadSchemaError(error)) {
          throw error;
        }
      }
    }

    throw new ServiceUnavailableException(
      `WaveSpeed face-aware request failed for model "${modelPath}". Last error: ${lastPayloadError ?? 'unknown'}`,
    );
  }

  private async runMannequinGeneration(
    modelPath: string,
    payload: Record<string, unknown>,
  ): Promise<string> {
    const submitPayload = await this.waveSpeedRequest<WaveSpeedApiEnvelope<WaveSpeedPredictionData>>(
      this.resolveWaveSpeedUrl(modelPath),
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );

    const submission = this.normalizePrediction(submitPayload);
    const immediateImage = this.extractImageUrl(submission.outputs) ?? this.extractImageUrl(submission.urls);
    if (this.isCompletedStatus(submission.status) && immediateImage) {
      return immediateImage;
    }

    if (this.isFailedStatus(submission.status, submission.error ?? submission.message)) {
      throw new ServiceUnavailableException(
        `WaveSpeed failed to generate mannequin image: ${this.stringifyUnknown(
          submission.error ?? submission.message,
        )}`,
      );
    }

    if (!submission.id) {
      throw new ServiceUnavailableException('WaveSpeed did not return task id');
    }

    const deadline = Date.now() + this.waveSpeedTimeoutMs;
    while (Date.now() < deadline) {
      await this.sleep(this.waveSpeedPollIntervalMs);

      const resultPayload = await this.waveSpeedRequest<WaveSpeedApiEnvelope<WaveSpeedPredictionData>>(
        this.resolveWaveSpeedUrl(`/predictions/${submission.id}/result`),
        { method: 'GET' },
      );

      const result = this.normalizePrediction(resultPayload);
      const imageUrl = this.extractImageUrl(result.outputs) ?? this.extractImageUrl(result.urls);

      if (this.isCompletedStatus(result.status)) {
        if (imageUrl) {
          return imageUrl;
        }
        throw new ServiceUnavailableException('WaveSpeed returned completed status without image');
      }

      if (this.isFailedStatus(result.status, result.error ?? result.message)) {
        throw new ServiceUnavailableException(
          `WaveSpeed failed to generate mannequin image: ${this.stringifyUnknown(
            result.error ?? result.message,
          )}`,
        );
      }
    }

    throw new ServiceUnavailableException('WaveSpeed mannequin generation timed out');
  }

  private buildCinematicPrompt(profile: BodyProfile): string {
    const height = this.toNullableNumber(profile.height_cm);
    const weight = this.toNullableNumber(profile.weight_kg);
    const chest = this.toNullableNumber(profile.chest_cm);
    const waist = this.toNullableNumber(profile.waist_cm);
    const hips = this.toNullableNumber(profile.hips_cm);
    const gender = this.toGenderDescriptor(profile.gender);

    const measurements = [
      height ? `height ${height} cm` : null,
      weight ? `weight ${weight} kg` : null,
      chest ? `chest ${chest} cm` : null,
      waist ? `waist ${waist} cm` : null,
      hips ? `hips ${hips} cm` : null,
      profile.body_shape ? `body shape ${profile.body_shape}` : null,
      gender ? `gender ${gender}` : null,
    ]
      .filter((value): value is string => Boolean(value))
      .join(', ');

    return [
      'cinematic full-body portrait photo of a single adult person,',
      'head-to-toe fully visible in frame, standing naturally, front-facing,',
      'realistic anatomy matching provided body measurements,',
      'person is fully clothed in simple fitted casual clothes (plain t-shirt and straight pants),',
      'fashion editorial style, cinematic composition, 35mm film look, soft dramatic studio lighting,',
      'neutral clean background, high detail, ultra realistic skin and texture,',
      'no text, no watermark, no logo, no extra limbs, no cropped body, no nudity.',
      measurements ? `Body characteristics: ${measurements}.` : '',
    ]
      .join(' ')
      .trim();
  }

  private buildFaceAwareCinematicPrompt(profile: BodyProfile): string {
    return [
      this.buildCinematicPrompt(profile),
      'Use the provided face reference image to preserve the same facial identity.',
      'Keep face structure, eyes, nose, lips, and skin tone aligned with the reference.',
      'Do not alter pose, framing intent, or full-body composition.',
      'No text, no watermark, no logo, no labels.',
    ].join(' ');
  }

  private buildFacePayloadCandidates(
    profile: BodyProfile,
    faceImage: string,
  ): Array<Record<string, unknown>> {
    const prompt = this.buildFaceAwareCinematicPrompt(profile);

    return [
      {
        prompt,
        images: [faceImage],
        aspect_ratio: this.waveSpeedImageAspectRatio,
        output_format: 'jpeg',
      },
      {
        prompt,
        images: [faceImage],
      },
      {
        prompt,
        images: [faceImage],
        size: this.waveSpeedImageSize,
      },
      {
        prompt,
        image: faceImage,
        size: this.waveSpeedImageSize,
      },
      {
        prompt,
        reference_images: [faceImage],
        size: this.waveSpeedImageSize,
      },
    ];
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

  private toNullableNumber(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private toGenderDescriptor(value: string | null | undefined): string | null {
    const normalized = (value ?? '').trim().toLowerCase();
    if (normalized === 'female') {
      return 'female';
    }

    if (normalized === 'male') {
      return 'male';
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
    defaults: string[] = [
      'bytedance/seedream-v3.1',
      'bytedance/seedream-v4',
      'bytedance/seedream-v4.5',
      'wavespeed-ai/flux-2-dev/text-to-image',
    ],
  ): string[] {
    const envCandidates = [primaryPath, ...(fallbackPaths?.split(',') ?? [])].flatMap((value) =>
      this.expandModelPathCandidate(value),
    );
    const allCandidates = [...envCandidates, ...defaults];
    const uniqueCandidates: string[] = [];

    for (const candidate of allCandidates.map((value) => this.normalizeModelPathCandidate(value))) {
      if (!candidate) {
        continue;
      }

      if (!uniqueCandidates.includes(candidate)) {
        uniqueCandidates.push(candidate);
      }
    }

    return uniqueCandidates;
  }

  private expandModelPathCandidate(value: string | undefined): string[] {
    const normalized = this.normalizeModelPathCandidate(value);
    if (!normalized) {
      return [];
    }

    const candidates = [normalized];
    if (normalized.endsWith('/text-to-image')) {
      const withoutTaskSuffix = normalized.slice(0, -'/text-to-image'.length);
      if (withoutTaskSuffix) {
        candidates.push(withoutTaskSuffix);
      }
    }

    return candidates;
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

  private resolveAspectRatioFromImageSize(size: string): string {
    const supported = new Set(['1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9']);
    const match = size.match(/^(\d+)\*(\d+)$/);
    if (!match) {
      return '2:3';
    }

    const width = Number.parseInt(match[1] ?? '', 10);
    const height = Number.parseInt(match[2] ?? '', 10);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return '2:3';
    }

    const divisor = this.gcd(width, height);
    const ratio = `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
    if (supported.has(ratio)) {
      return ratio;
    }

    return width >= height ? '3:2' : '2:3';
  }

  private gcd(a: number, b: number): number {
    let left = Math.abs(a);
    let right = Math.abs(b);

    while (right !== 0) {
      const temp = right;
      right = left % right;
      left = temp;
    }

    return left || 1;
  }

  private normalizeWaveSpeedImageInput(value: string, fieldName: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new BadRequestException(`${fieldName} is required`);
    }

    if (isDataUri(trimmed)) {
      this.assertLegacyDataUriSize(trimmed, fieldName);
      return trimmed;
    }

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === 'https:') {
        return parsed.toString();
      }
    } catch {
      // Fall through to validation error below.
    }

    throw new BadRequestException(`${fieldName} must be a valid HTTPS URL or a Data URI`);
  }

  private assertLegacyDataUriSize(value: string, fieldName: string) {
    const bytes = estimateDataUriBytes(value);
    if (bytes === null) {
      throw new BadRequestException(`${fieldName} must be a valid base64 Data URI`);
    }

    if (bytes > this.legacyDataUriMaxBytes) {
      throw new BadRequestException(
        `${fieldName} exceeds legacy Data URI size limit (${this.legacyDataUriMaxBytes} bytes)`,
      );
    }
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
