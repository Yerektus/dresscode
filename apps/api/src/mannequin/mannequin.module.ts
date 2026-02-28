import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MannequinVersion } from '../entities/mannequin-version.entity';
import { BodyProfile } from '../entities/body-profile.entity';
import { MannequinService } from './mannequin.service';
import { MannequinController } from './mannequin.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [TypeOrmModule.forFeature([MannequinVersion, BodyProfile]), StorageModule],
  controllers: [MannequinController],
  providers: [MannequinService],
  exports: [MannequinService],
})
export class MannequinModule {}
