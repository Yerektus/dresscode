import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MannequinVersion } from '../entities/mannequin-version.entity';
import { MannequinService } from './mannequin.service';
import { MannequinController } from './mannequin.controller';
import { StorageModule } from '../storage/storage.module';
import { BodyProfileModule } from '../body-profile/body-profile.module';
import { WaveSpeedModule } from '../wavespeed/wavespeed.module';

@Module({
  imports: [TypeOrmModule.forFeature([MannequinVersion]), StorageModule, BodyProfileModule, WaveSpeedModule],
  controllers: [MannequinController],
  providers: [MannequinService],
  exports: [MannequinService],
})
export class MannequinModule {}
