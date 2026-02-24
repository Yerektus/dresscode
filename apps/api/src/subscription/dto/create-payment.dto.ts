import { IsIn, IsString } from 'class-validator';

export class CreatePaymentDto {
  @IsString()
  @IsIn(['credits_50'])
  package_code: string;
}
