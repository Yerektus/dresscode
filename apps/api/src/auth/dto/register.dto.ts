import { IsEmail, IsString, MinLength } from 'class-validator';
import { Match } from '../decorators/match.decorator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @Match('password', { message: 'passwords do not match' })
  password_confirmation: string;
}
