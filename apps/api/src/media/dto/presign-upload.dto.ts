import { Type } from 'class-transformer';
import { IsIn, IsInt, IsString, Min } from 'class-validator';
import { MEDIA_UPLOAD_PURPOSES, type MediaUploadPurpose } from '../../storage/storage.constants';

export class PresignUploadDto {
  @IsIn(MEDIA_UPLOAD_PURPOSES)
  purpose!: MediaUploadPurpose;

  @IsString()
  content_type!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  size_bytes!: number;
}
