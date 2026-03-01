import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BodyProfile } from '../entities/body-profile.entity';
import { isDataUri } from '../storage/data-uri';
import { StorageService } from '../storage/storage.service';
import { CreateBodyProfileDto } from './dto/create-body-profile.dto';
import { assertLegacyDataUriSize, parsePositiveInt } from '../common/image-input.utils';

@Injectable()
export class BodyProfileService {
  private readonly legacyDataUriMaxBytes = parsePositiveInt(
    process.env.LEGACY_DATA_URI_MAX_BYTES,
    6 * 1024 * 1024,
  );

  constructor(
    @InjectRepository(BodyProfile)
    private readonly repo: Repository<BodyProfile>,
    private readonly storageService: StorageService,
  ) {}

  async findEntityByUser(userId: string): Promise<BodyProfile | null> {
    return this.repo.findOne({ where: { user_id: userId } });
  }

  async findByUser(userId: string) {
    const profile = await this.repo.findOne({ where: { user_id: userId } });
    if (!profile) {
      throw new NotFoundException('Body profile not found');
    }

    return this.toResponse(profile, userId);
  }

  async createOrUpdate(userId: string, dto: CreateBodyProfileDto) {
    const patch: Partial<BodyProfile> = { ...dto };
    delete (patch as Record<string, unknown>).face_image_asset_key;

    if (dto.face_image_asset_key !== undefined) {
      const normalizedKey = this.storageService.validateAssetKey(
        dto.face_image_asset_key,
        userId,
        'face_image',
      );
      patch.face_image = this.storageService.toStoredAssetReference(normalizedKey);
    } else if (dto.face_image !== undefined) {
      patch.face_image = this.normalizeLegacyFaceImageInput(dto.face_image);
    }

    let profile = await this.repo.findOne({ where: { user_id: userId } });
    if (profile) {
      Object.assign(profile, patch);
    } else {
      profile = this.repo.create({ ...patch, user_id: userId });
    }

    const saved = await this.repo.save(profile);
    return this.toResponse(saved, userId);
  }

  private async toResponse(profile: BodyProfile, userId: string) {
    const assetKey = this.storageService.extractAssetKeyFromReference(profile.face_image);
    if (!assetKey) {
      return {
        ...profile,
        face_image_asset_key: null,
      };
    }

    const normalizedAssetKey = this.storageService.validateAssetKey(assetKey, userId, 'face_image');
    return {
      ...profile,
      face_image: await this.storageService.createSignedReadUrl(normalizedAssetKey),
      face_image_asset_key: normalizedAssetKey,
    };
  }

  private normalizeLegacyFaceImageInput(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new BadRequestException('face_image must be a valid HTTPS URL or a Data URI');
    }

    if (isDataUri(trimmed)) {
      assertLegacyDataUriSize(trimmed, 'face_image', this.legacyDataUriMaxBytes);
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

    throw new BadRequestException('face_image must be a valid HTTPS URL or a Data URI');
  }
}
