import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateEmailDto } from './dto/update-email.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(202)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @Post('resend-verification')
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto.email);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Request() req: { user: { id: string } }) {
    return this.authService.getMe(req.user.id);
  }

  @Patch('me/email')
  @UseGuards(JwtAuthGuard)
  updateEmail(
    @Request() req: { user: { id: string } },
    @Body() dto: UpdateEmailDto,
  ) {
    return this.authService.updateEmail(req.user.id, dto.email);
  }

  @Post('me/email/resend-verification')
  @UseGuards(JwtAuthGuard)
  resendPendingEmailVerification(@Request() req: { user: { id: string } }) {
    return this.authService.resendPendingEmailVerification(req.user.id);
  }

  @Patch('me/password')
  @UseGuards(JwtAuthGuard)
  updatePassword(
    @Request() req: { user: { id: string } },
    @Body() dto: UpdatePasswordDto,
  ) {
    return this.authService.updatePassword(req.user.id, dto.current_password, dto.new_password);
  }
}
