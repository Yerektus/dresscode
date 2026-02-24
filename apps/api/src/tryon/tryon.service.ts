import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TryOnRequest } from '../entities/try-on-request.entity';
import { TryOnResult } from '../entities/try-on-result.entity';
import { Subscription } from '../entities/subscription.entity';
import { CreateTryOnDto } from './dto/create-tryon.dto';

@Injectable()
export class TryOnService {
  constructor(
    @InjectRepository(TryOnRequest)
    private readonly requestRepo: Repository<TryOnRequest>,
    @InjectRepository(TryOnResult)
    private readonly resultRepo: Repository<TryOnResult>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
  ) {}

  async create(userId: string, dto: CreateTryOnDto) {
    await this.checkQuota(userId);

    const request = this.requestRepo.create({
      user_id: userId,
      mannequin_version_id: dto.mannequin_version_id,
      garment_image_url: dto.garment_image,
      category: dto.category,
      selected_size: dto.selected_size,
    });
    await this.requestRepo.save(request);

    // Placeholder inference — real ML model integration goes here
    const fitProbability = Math.round(60 + Math.random() * 35);
    const result = this.resultRepo.create({
      request_id: request.id,
      result_image_url: '/tryon/placeholder-result.png',
      fit_probability: fitProbability,
      fit_breakdown_json: {
        shoulders: Math.round(70 + Math.random() * 25),
        chest: Math.round(70 + Math.random() * 25),
        waist: Math.round(70 + Math.random() * 25),
        hips: Math.round(70 + Math.random() * 25),
        length: Math.round(70 + Math.random() * 25),
      },
      model_version: 'v0.1.0-placeholder',
    });
    await this.resultRepo.save(result);

    return { request, result };
  }

  async getHistory(userId: string) {
    return this.requestRepo.find({
      where: { user_id: userId },
      relations: ['result'],
      order: { created_at: 'DESC' },
    });
  }

  private async checkQuota(userId: string) {
    const sub = await this.subscriptionRepo.findOne({ where: { user_id: userId } });
    const limit = sub?.plan_code === 'premium' ? 200 : 5;

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const count = await this.requestRepo
      .createQueryBuilder('r')
      .where('r.user_id = :userId', { userId })
      .andWhere('r.created_at >= :since', { since: thisMonth })
      .getCount();

    if (count >= limit) {
      throw new ForbiddenException(`Monthly try-on limit reached (${limit}). Upgrade to Premium for more.`);
    }
  }
}
