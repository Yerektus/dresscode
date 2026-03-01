import { Module } from '@nestjs/common';
import { WaveSpeedService } from './wavespeed.service';

@Module({
  providers: [WaveSpeedService],
  exports: [WaveSpeedService],
})
export class WaveSpeedModule {}
