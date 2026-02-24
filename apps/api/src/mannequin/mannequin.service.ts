import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MannequinVersion } from '../entities/mannequin-version.entity';
import { BodyProfile } from '../entities/body-profile.entity';

@Injectable()
export class MannequinService {
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
      front_image_url: '/mannequin/placeholder-front.png',
      side_image_url: null,
      is_active: true,
    });

    return this.repo.save(version);
  }
}
