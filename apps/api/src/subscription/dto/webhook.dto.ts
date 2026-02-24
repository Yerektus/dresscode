import { IsString } from 'class-validator';

export class WebkassaWebhookDto {
  @IsString()
  payment_id: string;

  @IsString()
  status: string;

  @IsString()
  signature: string;
}
