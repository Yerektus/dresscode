import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TryOnRequest } from '../entities/try-on-request.entity';
import { TryOnResult } from '../entities/try-on-result.entity';
import { Subscription } from '../entities/subscription.entity';
import { TryOnService } from './tryon.service';
import { TryOnController } from './tryon.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TryOnRequest, TryOnResult, Subscription])],
  controllers: [TryOnController],
  providers: [TryOnService],
})
export class TryOnModule {}
