import { IsString } from 'class-validator';

export class CreatePaymentDto {
  @IsString()
  plan_code: string;
}
