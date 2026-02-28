import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailVerificationToken } from '../entities/email-verification-token.entity';
import { User } from '../entities/user.entity';
import { MailModule } from '../mail/mail.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { EmailVerificationService } from './email-verification.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, EmailVerificationToken]),
    MailModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dresscode-dev-secret',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, EmailVerificationService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
