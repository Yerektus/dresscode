import { IsString, IsUUID } from 'class-validator';

export class CreateTryOnDto {
  @IsString()
  garment_image!: string;

  @IsString()
  category!: string;

  @IsString()
  selected_size!: string;

  @IsUUID()
  mannequin_version_id!: string;
}
