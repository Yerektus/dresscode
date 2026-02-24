import { Injectable, NotFoundException } from '@nestjs/common';
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
    let profile = await this.repo.findOne({ where: { user_id: userId } });
    if (profile) {
      Object.assign(profile, dto);
    } else {
      profile = this.repo.create({ ...dto, user_id: userId });
    }
    return this.repo.save(profile);
  }
}
