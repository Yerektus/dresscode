import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BodyProfileService } from './body-profile.service';
import { CreateBodyProfileDto } from './dto/create-body-profile.dto';

@Controller('body-profile')
@UseGuards(JwtAuthGuard)
export class BodyProfileController {
  constructor(private readonly service: BodyProfileService) {}

  @Get()
  findMine(@Request() req: { user: { id: string } }) {
    return this.service.findByUser(req.user.id);
  }

  @Post()
  createOrUpdate(
    @Request() req: { user: { id: string } },
    @Body() dto: CreateBodyProfileDto,
  ) {
    return this.service.createOrUpdate(req.user.id, dto);
  }
}
