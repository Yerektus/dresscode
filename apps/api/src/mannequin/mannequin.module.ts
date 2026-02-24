import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MannequinVersion } from '../entities/mannequin-version.entity';
import { BodyProfile } from '../entities/body-profile.entity';
import { MannequinService } from './mannequin.service';
import { MannequinController } from './mannequin.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MannequinVersion, BodyProfile])],
  controllers: [MannequinController],
  providers: [MannequinService],
  exports: [MannequinService],
})
export class MannequinModule {}
