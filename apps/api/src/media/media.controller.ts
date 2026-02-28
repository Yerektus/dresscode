import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PresignUploadDto } from './dto/presign-upload.dto';
import { MediaService } from './media.service';

@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('presign-upload')
  createPresignedUpload(
    @Request() req: { user: { id: string } },
    @Body() dto: PresignUploadDto,
  ) {
    return this.mediaService.createPresignedUpload(req.user.id, dto);
  }
}
