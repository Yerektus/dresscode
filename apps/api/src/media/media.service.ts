import { Injectable } from '@nestjs/common';
import { PresignUploadDto } from './dto/presign-upload.dto';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class MediaService {
  constructor(private readonly storageService: StorageService) {}

  createPresignedUpload(userId: string, dto: PresignUploadDto) {
    return this.storageService.createPresignedUpload({
      userId,
      purpose: dto.purpose,
      contentType: dto.content_type,
      sizeBytes: dto.size_bytes,
    });
  }
}
