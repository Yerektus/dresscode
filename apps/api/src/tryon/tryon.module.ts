import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TryOnRequest } from '../entities/try-on-request.entity';
import { TryOnResult } from '../entities/try-on-result.entity';
import { TryOnService } from './tryon.service';
import { TryOnController } from './tryon.controller';
import { StorageModule } from '../storage/storage.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { MannequinModule } from '../mannequin/mannequin.module';
import { WaveSpeedModule } from '../wavespeed/wavespeed.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TryOnRequest, TryOnResult]),
    StorageModule,
    SubscriptionModule,
    MannequinModule,
    WaveSpeedModule,
  ],
  controllers: [TryOnController],
  providers: [TryOnService],
})
export class TryOnModule {}
