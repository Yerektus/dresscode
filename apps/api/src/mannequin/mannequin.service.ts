import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MannequinVersion } from '../entities/mannequin-version.entity';
import { BodyProfile } from '../entities/body-profile.entity';

interface WaveSpeedPredictionResponse {
  id?: string;
  status?: string;
  data?: unknown;
  message?: string;
}

@Injectable()
export class MannequinService {
  private readonly waveSpeedApiBaseUrl =
    process.env.WAVESPEED_API_BASE_URL ?? 'https://api.wavespeed.ai/api/v3';
  private readonly waveSpeedModelPath =
    process.env.WAVESPEED_MODEL_PATH ?? '/bytedance/seedream-v3/text-to-image';
  private readonly waveSpeedImageSize = process.env.WAVESPEED_IMAGE_SIZE ?? '1024x1536';
  private readonly waveSpeedPollIntervalMs = this.parsePositiveInt(
    process.env.WAVESPEED_POLL_INTERVAL_MS,
    1500,
  );
  private readonly waveSpeedTimeoutMs = this.parsePositiveInt(
    process.env.WAVESPEED_TIMEOUT_MS,
    90000,
  );

  constructor(
    @InjectRepository(MannequinVersion)
    private readonly repo: Repository<MannequinVersion>,
    @InjectRepository(BodyProfile)
    private readonly bodyProfileRepo: Repository<BodyProfile>,
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

    const generatedImageUrl = await this.generateMannequinImage(profile);

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
      },
      front_image_url: generatedImageUrl,
      side_image_url: null,
      is_active: true,
    });

    return this.repo.save(version);
  }

  private async generateMannequinImage(profile: BodyProfile): Promise<string> {
    const response = await this.waveSpeedRequest<WaveSpeedPredictionResponse>(
      this.resolveWaveSpeedUrl(this.waveSpeedModelPath),
      {
        method: 'POST',
        body: JSON.stringify({
          prompt: this.buildCinematicPrompt(profile),
          size: this.waveSpeedImageSize,
          seed: Math.floor(Math.random() * 1_000_000_000),
        }),
      },
    );

    const status = this.normalizeStatus(response.status);
    const immediateImage = this.extractImageUrl(response.data);
    if (status === 'SUCCESS' && immediateImage) {
      return immediateImage;
    }

    if (status === 'FAILED' || status === 'ERROR' || status === 'CANCELLED') {
      throw new ServiceUnavailableException('WaveSpeed failed to generate mannequin image');
    }

    if (!response.id) {
      throw new ServiceUnavailableException('WaveSpeed did not return task id');
    }

    const deadline = Date.now() + this.waveSpeedTimeoutMs;
    while (Date.now() < deadline) {
      await this.sleep(this.waveSpeedPollIntervalMs);

      const result = await this.waveSpeedRequest<WaveSpeedPredictionResponse>(
        this.resolveWaveSpeedUrl(`/predictions/${response.id}/result`),
        { method: 'GET' },
      );

      const resultStatus = this.normalizeStatus(result.status);
      const imageUrl = this.extractImageUrl(result.data);

      if (resultStatus === 'SUCCESS') {
        if (imageUrl) {
          return imageUrl;
        }
        throw new ServiceUnavailableException('WaveSpeed returned SUCCESS without image url');
      }

      if (resultStatus === 'FAILED' || resultStatus === 'ERROR' || resultStatus === 'CANCELLED') {
        throw new ServiceUnavailableException('WaveSpeed failed to generate mannequin image');
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

    const measurements = [
      height ? `height ${height} cm` : null,
      weight ? `weight ${weight} kg` : null,
      chest ? `chest ${chest} cm` : null,
      waist ? `waist ${waist} cm` : null,
      hips ? `hips ${hips} cm` : null,
      profile.body_shape ? `body shape ${profile.body_shape}` : null,
    ]
      .filter((value): value is string => Boolean(value))
      .join(', ');

    return [
      'cinematic full-body portrait photo of a single adult person,',
      'head-to-toe fully visible in frame, standing naturally, front-facing,',
      'realistic anatomy matching provided body measurements,',
      'fashion editorial style, 35mm film look, soft dramatic studio lighting,',
      'neutral clean background, high detail, ultra realistic skin and texture,',
      'no text, no watermark, no logo, no extra limbs, no cropped body.',
      measurements ? `Body characteristics: ${measurements}.` : '',
    ]
      .join(' ')
      .trim();
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

  private normalizeStatus(status: string | undefined): string {
    return (status ?? '').toUpperCase();
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
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const message = (payload as Record<string, unknown>).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
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

  private parsePositiveInt(rawValue: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(rawValue ?? '', 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }
    return parsed;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
