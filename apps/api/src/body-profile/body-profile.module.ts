import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BodyProfile } from '../entities/body-profile.entity';
import { BodyProfileService } from './body-profile.service';
import { BodyProfileController } from './body-profile.controller';

@Module({
  imports: [TypeOrmModule.forFeature([BodyProfile])],
  controllers: [BodyProfileController],
  providers: [BodyProfileService],
  exports: [BodyProfileService],
})
export class BodyProfileModule {}
