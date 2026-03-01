import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MannequinVersion } from '../entities/mannequin-version.entity';
import { BodyProfile } from '../entities/body-profile.entity';
import { StorageService } from '../storage/storage.service';
import { BodyProfileService } from '../body-profile/body-profile.service';
import { WaveSpeedService } from '../wavespeed/wavespeed.service';
import { parsePositiveInt, normalizeWaveSpeedImageInput } from '../common/image-input.utils';

@Injectable()
export class MannequinService {
  private readonly waveSpeedModelPaths: string[];
  private readonly waveSpeedFaceModelPaths: string[];
  private readonly waveSpeedImageSize = this.normalizeImageSize(
    process.env.WAVESPEED_IMAGE_SIZE ?? '1024*1536',
  );
  private readonly waveSpeedImageAspectRatio = this.resolveAspectRatioFromImageSize(
    this.waveSpeedImageSize,
  );
  private readonly legacyDataUriMaxBytes = parsePositiveInt(
    process.env.LEGACY_DATA_URI_MAX_BYTES,
    6 * 1024 * 1024,
  );

  constructor(
    @InjectRepository(MannequinVersion)
    private readonly repo: Repository<MannequinVersion>,
    private readonly storageService: StorageService,
    private readonly bodyProfileService: BodyProfileService,
    private readonly ws: WaveSpeedService,
  ) {
    this.waveSpeedModelPaths = this.ws.buildModelPathCandidates(
      process.env.WAVESPEED_MODEL_PATH,
      process.env.WAVESPEED_MODEL_FALLBACK_PATHS,
      [
        'bytedance/seedream-v3.1',
        'bytedance/seedream-v4',
        'bytedance/seedream-v4.5',
        'wavespeed-ai/flux-2-dev/text-to-image',
      ],
    );
    this.waveSpeedFaceModelPaths = this.ws.buildModelPathCandidates(
      process.env.WAVESPEED_MANNEQUIN_FACE_MODEL_PATH,
      process.env.WAVESPEED_MANNEQUIN_FACE_MODEL_FALLBACK_PATHS,
      [],
    );
  }

  async getActive(userId: string) {
    const mannequin = await this.repo.findOne({
      where: { user_id: userId, is_active: true },
    });
    if (!mannequin) throw new NotFoundException('No active mannequin');
    return mannequin;
  }

  async findByIdAndUser(id: string, userId: string): Promise<MannequinVersion | null> {
    return this.repo.findOne({ where: { id, user_id: userId } });
  }

  async generate(userId: string) {
    const profile = await this.bodyProfileService.findEntityByUser(userId);
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
      return this.storageService.getObjectAsDataUri(normalizedKey);
    }

    return normalizeWaveSpeedImageInput(value, 'Face image', this.legacyDataUriMaxBytes);
  }

  private async generateMannequinImage(profile: BodyProfile): Promise<string> {
    let lastModelError: string | null = null;

    for (const modelPath of this.waveSpeedModelPaths) {
      try {
        return await this.generateMannequinImageWithModel(profile, modelPath);
      } catch (error) {
        if (!this.ws.isModelMissingError(error)) {
          throw error;
        }

        lastModelError = this.ws.extractErrorText(error);
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
        if (!this.ws.isModelMissingError(error)) {
          throw error;
        }

        lastModelError = this.ws.extractErrorText(error);
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
    const result = await this.ws.submitAndPoll(modelPath, {
      prompt: this.buildCinematicPrompt(profile),
      size: this.waveSpeedImageSize,
      seed: -1,
      enable_prompt_expansion: true,
      enable_base64_output: false,
    });

    const imageUrl = this.ws.extractImageUrl(result.outputs) ?? this.ws.extractImageUrl(result.urls);
    if (!imageUrl) {
      throw new ServiceUnavailableException('WaveSpeed returned completed status without image');
    }
    return imageUrl;
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
        const result = await this.ws.submitAndPoll(modelPath, payload);
        const imageUrl = this.ws.extractImageUrl(result.outputs) ?? this.ws.extractImageUrl(result.urls);
        if (!imageUrl) {
          throw new ServiceUnavailableException('WaveSpeed returned completed status without image');
        }
        return imageUrl;
      } catch (error) {
        lastPayloadError = this.ws.extractErrorText(error);
        if (!this.ws.isPayloadSchemaError(error)) {
          throw error;
        }
      }
    }

    throw new ServiceUnavailableException(
      `WaveSpeed face-aware request failed for model "${modelPath}". Last error: ${lastPayloadError ?? 'unknown'}`,
    );
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
}
