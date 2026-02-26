import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BodyProfile } from '../entities/body-profile.entity';
import { CreateBodyProfileDto } from './dto/create-body-profile.dto';

@Injectable()
export class BodyProfileService {
  constructor(
    @InjectRepository(BodyProfile)
    private readonly repo: Repository<BodyProfile>,
  ) {}

  async findByUser(userId: string) {
    const profile = await this.repo.findOne({ where: { user_id: userId } });
    if (!profile) {
      throw new NotFoundException('Body profile not found');
    }

    return profile;
  }

  async createOrUpdate(userId: string, dto: CreateBodyProfileDto) {
    const patch: Partial<BodyProfile> = { ...dto };
    if (dto.face_image !== undefined) {
      patch.face_image = this.normalizeFaceImageInput(dto.face_image);
    }

    let profile = await this.repo.findOne({ where: { user_id: userId } });
    if (profile) {
      Object.assign(profile, patch);
    } else {
      profile = this.repo.create({ ...patch, user_id: userId });
    }
    return this.repo.save(profile);
  }

  private normalizeFaceImageInput(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new BadRequestException('face_image must be a valid HTTPS URL or a Data URI');
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

    throw new BadRequestException('face_image must be a valid HTTPS URL or a Data URI');
  }
}
