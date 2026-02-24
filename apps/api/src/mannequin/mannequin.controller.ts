import { Controller, Get, Post, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MannequinService } from './mannequin.service';

@Controller('mannequin')
@UseGuards(JwtAuthGuard)
export class MannequinController {
  constructor(private readonly service: MannequinService) {}

  @Get('active')
  getActive(@Request() req: { user: { id: string } }) {
    return this.service.getActive(req.user.id);
  }

  @Post('generate')
  generate(@Request() req: { user: { id: string } }) {
    return this.service.generate(req.user.id);
  }
}
