import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { EmailVerificationService } from './email-verification.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

export interface PublicUser {
  id: string;
  email: string;
  email_verified: boolean;
  email_verified_at: Date | null;
  pending_email: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface RegisterResponse {
  message: string;
  verification_required: true;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly emailVerificationService: EmailVerificationService,
  ) {}

  async register(dto: RegisterDto): Promise<RegisterResponse> {
    const email = this.normalizeEmail(dto.email);
    const existing = await this.userRepo.findOne({
      where: [{ email }, { pending_email: email }],
    });
    if (existing) {
      if (existing.email === email && !existing.email_verified_at) {
        await this.emailVerificationService.issueVerificationEmail({
          user: existing,
          email,
          purpose: 'register',
        });
        return this.buildRegisterResponse();
      }

      throw new ConflictException('Email already registered');
    }

    const password_hash = await bcrypt.hash(dto.password, 12);
    const user = this.userRepo.create({
      email,
      password_hash,
      email_verified_at: null,
      pending_email: null,
    });
    await this.userRepo.save(user);

    await this.emailVerificationService.issueVerificationEmail({
      user,
      email,
      purpose: 'register',
    });

    return this.buildRegisterResponse();
  }

  async login(dto: LoginDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.email_verified_at) {
      throw new ForbiddenException('Email is not verified');
    }

    return this.buildAuthResponse(user);
  }

  async getMe(userId: string): Promise<PublicUser> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.toPublicUser(user);
  }

  async updateEmail(userId: string, nextEmail: string): Promise<PublicUser> {
    const normalizedEmail = this.normalizeEmail(nextEmail);
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.email === normalizedEmail) {
      return this.toPublicUser(user);
    }

    if (user.pending_email === normalizedEmail) {
      await this.emailVerificationService.issueVerificationEmail({
        user,
        email: normalizedEmail,
        purpose: 'change_email',
      });
      return this.toPublicUser(user);
    }

    const existingWithEmail = await this.userRepo.findOne({
      where: [{ email: normalizedEmail }, { pending_email: normalizedEmail }],
    });
    if (existingWithEmail && existingWithEmail.id !== userId) {
      throw new ConflictException('Email already registered');
    }

    user.pending_email = normalizedEmail;
    const updatedUser = await this.userRepo.save(user);
    await this.emailVerificationService.issueVerificationEmail({
      user: updatedUser,
      email: normalizedEmail,
      purpose: 'change_email',
    });

    return this.toPublicUser(updatedUser);
  }

  async resendVerification(email: string): Promise<{ message: string }> {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.userRepo.findOne({ where: { email: normalizedEmail } });
    if (!user || user.email_verified_at) {
      return {
        message: 'If account exists, verification email sent',
      };
    }

    try {
      await this.emailVerificationService.issueVerificationEmail({
        user,
        email: user.email,
        purpose: 'register',
        enforceCooldown: true,
      });
    } catch (error) {
      console.error('Failed to resend verification email', error);
    }

    return {
      message: 'If account exists, verification email sent',
    };
  }

  async resendPendingEmailVerification(
    userId: string,
  ): Promise<{ message: string; pending_email: string }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const pendingEmail = this.normalizeNullableEmail(user.pending_email);
    if (!pendingEmail) {
      throw new BadRequestException('No pending email to verify');
    }

    const issueResult = await this.emailVerificationService.issueVerificationEmail({
      user,
      email: pendingEmail,
      purpose: 'change_email',
      enforceCooldown: true,
    });

    return {
      message: issueResult.sent
        ? 'Verification email sent'
        : 'Verification email was sent recently. Please check your inbox.',
      pending_email: pendingEmail,
    };
  }

  async verifyEmail(token: string) {
    const user = await this.emailVerificationService.verifyTokenAndApply(token);
    return this.buildAuthResponse(user);
  }

  async updatePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const passwordMatches = await bcrypt.compare(currentPassword, user.password_hash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password_hash);
    if (isSamePassword) {
      throw new BadRequestException('New password must be different from current password');
    }

    user.password_hash = await bcrypt.hash(newPassword, 12);
    await this.userRepo.save(user);

    return { message: 'Password updated successfully' };
  }

  private buildAuthResponse(user: User) {
    const payload = { sub: user.id, email: user.email };
    return {
      access_token: this.jwtService.sign(payload),
      user: this.toPublicUser(user),
    };
  }

  private buildRegisterResponse(): RegisterResponse {
    return {
      message: 'Verification email sent. Please check your inbox.',
      verification_required: true,
    };
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      email_verified: Boolean(user.email_verified_at),
      email_verified_at: user.email_verified_at ?? null,
      pending_email: user.pending_email ?? null,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private normalizeNullableEmail(value: string | null | undefined): string | null {
    if (!value) {
      return null;
    }

    const normalized = this.normalizeEmail(value);
    return normalized || null;
  }
}
