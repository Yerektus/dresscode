import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateBodyProfileDto {
  @IsNumber()
  @Min(50)
  height_cm!: number;

  @IsNumber()
  @Min(20)
  weight_kg!: number;

  @IsOptional()
  @IsNumber()
  chest_cm?: number;

  @IsOptional()
  @IsNumber()
  waist_cm?: number;

  @IsOptional()
  @IsNumber()
  hips_cm?: number;

  @IsOptional()
  @IsNumber()
  sleeve_cm?: number;

  @IsOptional()
  @IsNumber()
  inseam_cm?: number;

  @IsOptional()
  @IsString()
  body_shape?: string;
}
