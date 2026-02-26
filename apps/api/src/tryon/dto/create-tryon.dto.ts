import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateTryOnDto {
  @IsString()
  garment_image!: string;

  @IsString()
  category!: string;

  @IsString()
  selected_size!: string;

  @IsUUID()
  mannequin_version_id!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  chest_cm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  waist_cm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  hips_cm?: number;
}
