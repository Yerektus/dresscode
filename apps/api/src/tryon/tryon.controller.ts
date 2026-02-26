import { Controller, Get, Post, Body, UseGuards, Request, Param, ParseUUIDPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TryOnService } from './tryon.service';
import { CreateTryOnDto } from './dto/create-tryon.dto';

@Controller('tryon')
@UseGuards(JwtAuthGuard)
export class TryOnController {
  constructor(private readonly service: TryOnService) {}

  @Post()
  create(
    @Request() req: { user: { id: string } },
    @Body() dto: CreateTryOnDto,
  ) {
    return this.service.create(req.user.id, dto);
  }

  @Get('history')
  getHistory(@Request() req: { user: { id: string } }) {
    return this.service.getHistory(req.user.id);
  }

  @Get(':requestId')
  getById(
    @Request() req: { user: { id: string } },
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
  ) {
    return this.service.getById(req.user.id, requestId);
  }
}
