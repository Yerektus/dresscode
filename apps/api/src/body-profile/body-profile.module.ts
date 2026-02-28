import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BodyProfile } from '../entities/body-profile.entity';
import { BodyProfileService } from './body-profile.service';
import { BodyProfileController } from './body-profile.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [TypeOrmModule.forFeature([BodyProfile]), StorageModule],
  controllers: [BodyProfileController],
  providers: [BodyProfileService],
  exports: [BodyProfileService],
})
export class BodyProfileModule {}
