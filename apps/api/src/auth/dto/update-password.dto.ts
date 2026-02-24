import { IsString, MinLength } from 'class-validator';
import { Match } from '../decorators/match.decorator';

export class UpdatePasswordDto {
  @IsString()
  @MinLength(1)
  current_password!: string;

  @IsString()
  @MinLength(8)
  new_password!: string;

  @IsString()
  @Match('new_password', { message: 'passwords do not match' })
  new_password_confirmation!: string;
}
