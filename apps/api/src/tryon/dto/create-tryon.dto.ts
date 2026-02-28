import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUUID, Min, ValidateIf } from 'class-validator';

export class CreateTryOnDto {
  @ValidateIf((value: CreateTryOnDto) => !value.garment_asset_key)
  @IsString()
  garment_image?: string;

  @ValidateIf((value: CreateTryOnDto) => !value.garment_image)
  @IsString()
  garment_asset_key?: string;

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
