import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { TryOnRequest } from '../entities/try-on-request.entity';
import { TryOnResult } from '../entities/try-on-result.entity';
import { Subscription } from '../entities/subscription.entity';
import { CreateTryOnDto } from './dto/create-tryon.dto';

@Injectable()
export class TryOnService {
  constructor(
    @InjectRepository(TryOnRequest)
    private readonly requestRepo: Repository<TryOnRequest>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async create(userId: string, dto: CreateTryOnDto) {
    return this.dataSource.transaction(async (manager) => {
      await manager
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
        garment_image_url: dto.garment_image,
        category: dto.category,
        selected_size: dto.selected_size,
      });
      await manager.getRepository(TryOnRequest).save(request);

      // Placeholder inference — real ML model integration goes here
      const fitProbability = Math.round(60 + Math.random() * 35);
      const result = manager.getRepository(TryOnResult).create({
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
      await manager.getRepository(TryOnResult).save(result);

      return { request, result };
    });
  }

  async getHistory(userId: string) {
    return this.requestRepo.find({
      where: { user_id: userId },
      relations: ['result'],
      order: { created_at: 'DESC' },
    });
  }
}
