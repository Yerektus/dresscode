import { randomBytes, createHash } from 'crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, MoreThan, Repository } from 'typeorm';
import {
  EmailVerificationPurpose,
  EmailVerificationToken,
} from '../entities/email-verification-token.entity';
import { User } from '../entities/user.entity';
import { MailService } from '../mail/mail.service';

interface IssueVerificationEmailInput {
  user: User;
  email: string;
  purpose: EmailVerificationPurpose;
  enforceCooldown?: boolean;
}

@Injectable()
export class EmailVerificationService {
  private readonly webPublicUrl = (process.env.WEB_PUBLIC_URL ?? 'http://localhost:8081').trim();
  private readonly ttlSeconds = this.parsePositiveInt(
    process.env.EMAIL_VERIFICATION_TTL_SECONDS,
    24 * 60 * 60,
  );
  private readonly resendCooldownSeconds = this.parsePositiveInt(
    process.env.EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS,
    60,
  );

  constructor(
    @InjectRepository(EmailVerificationToken)
    private readonly tokenRepo: Repository<EmailVerificationToken>,
    private readonly dataSource: DataSource,
    private readonly mailService: MailService,
  ) {}

  async issueVerificationEmail(input: IssueVerificationEmailInput): Promise<{ sent: boolean }> {
    const normalizedEmail = this.normalizeEmail(input.email);
    const purpose = input.purpose;
    const shouldEnforceCooldown = input.enforceCooldown ?? false;

    if (shouldEnforceCooldown && (await this.hasRecentToken(normalizedEmail, purpose))) {
      return { sent: false };
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + this.ttlSeconds * 1000);

    await this.dataSource.transaction(async (manager) => {
      const managerTokenRepo = manager.getRepository(EmailVerificationToken);
      await managerTokenRepo
        .createQueryBuilder()
        .update(EmailVerificationToken)
        .set({ used_at: new Date() })
        .where('user_id = :userId', { userId: input.user.id })
        .andWhere('purpose = :purpose', { purpose })
        .andWhere('email = :email', { email: normalizedEmail })
        .andWhere('used_at IS NULL')
        .execute();

      const token = managerTokenRepo.create({
        user_id: input.user.id,
        email: normalizedEmail,
        purpose,
        token_hash: tokenHash,
        expires_at: expiresAt,
        used_at: null,
      });
      await managerTokenRepo.save(token);
    });

    await this.mailService.sendEmailVerification({
      to: normalizedEmail,
      verifyUrl: this.buildVerifyUrl(rawToken),
    });

    return { sent: true };
  }

  async verifyTokenAndApply(rawToken: string): Promise<User> {
    const normalizedToken = rawToken.trim();
    if (!normalizedToken) {
      throw new BadRequestException('Verification token is invalid');
    }

    const tokenHash = this.hashToken(normalizedToken);

    return this.dataSource.transaction(async (manager) => {
      const managerTokenRepo = manager.getRepository(EmailVerificationToken);
      const managerUserRepo = manager.getRepository(User);

      const token = await managerTokenRepo.findOne({
        where: { token_hash: tokenHash },
        relations: ['user'],
      });

      if (!token) {
        throw new BadRequestException('Verification token is invalid');
      }
      if (token.used_at) {
        throw new BadRequestException('Verification token is already used');
      }
      if (token.expires_at.getTime() < Date.now()) {
        throw new BadRequestException('Verification token expired');
      }

      const user =
        token.user ?? (await managerUserRepo.findOne({ where: { id: token.user_id } }));
      if (!user) {
        throw new BadRequestException('Verification token is invalid');
      }

      const now = new Date();
      if (token.purpose === 'register') {
        if (!user.email_verified_at) {
          user.email_verified_at = now;
        }
      } else if (token.purpose === 'change_email') {
        const normalizedPendingEmail = this.normalizeNullableEmail(user.pending_email);
        if (!normalizedPendingEmail || normalizedPendingEmail !== token.email) {
          throw new BadRequestException('Verification token is invalid');
        }

        user.email = normalizedPendingEmail;
        user.pending_email = null;
        user.email_verified_at = now;
      } else {
        throw new BadRequestException('Verification token is invalid');
      }

      await managerUserRepo.save(user);

      const markResult = await managerTokenRepo
        .createQueryBuilder()
        .update(EmailVerificationToken)
        .set({ used_at: now })
        .where('id = :id', { id: token.id })
        .andWhere('used_at IS NULL')
        .execute();

      if (!markResult.affected) {
        throw new BadRequestException('Verification token is already used');
      }

      return user;
    });
  }

  private async hasRecentToken(
    email: string,
    purpose: EmailVerificationPurpose,
  ): Promise<boolean> {
    const cutoff = new Date(Date.now() - this.resendCooldownSeconds * 1000);
    const recentToken = await this.tokenRepo.findOne({
      where: {
        email,
        purpose,
        created_at: MoreThan(cutoff),
      },
      order: { created_at: 'DESC' },
    });

    return Boolean(recentToken);
  }

  private buildVerifyUrl(rawToken: string): string {
    const base = this.webPublicUrl.endsWith('/')
      ? this.webPublicUrl.slice(0, -1)
      : this.webPublicUrl;
    return `${base}/verify-email?token=${encodeURIComponent(rawToken)}`;
  }

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
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

  private parsePositiveInt(raw: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(raw ?? '', 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }

    return parsed;
  }
}
