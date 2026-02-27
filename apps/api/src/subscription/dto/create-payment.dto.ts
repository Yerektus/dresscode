import { IsIn, IsString } from 'class-validator';

export class CreatePaymentDto {
  @IsString()
  @IsIn(['credits_20', 'credits_50', 'credits_100'])
  package_code: string;
}
