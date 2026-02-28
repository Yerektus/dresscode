import { Injectable, ServiceUnavailableException } from '@nestjs/common';

interface SendEmailVerificationInput {
  to: string;
  verifyUrl: string;
}

interface MailTransport {
  sendMail(input: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<unknown>;
}

@Injectable()
export class MailService {
  private readonly from = process.env.SMTP_FROM?.trim() || '';
  private readonly transporter: MailTransport | null;

  constructor() {
    const host = process.env.SMTP_HOST?.trim();
    if (!host) {
      this.transporter = null;
      return;
    }
    const nodemailerModule = this.resolveNodemailerModule();
    if (!nodemailerModule) {
      this.transporter = null;
      return;
    }

    const portRaw = Number.parseInt(process.env.SMTP_PORT ?? '', 10);
    const port = Number.isFinite(portRaw) && portRaw > 0 ? portRaw : 587;
    const secure = this.parseBoolean(process.env.SMTP_SECURE, false);
    const user = process.env.SMTP_USER?.trim();
    const password = process.env.SMTP_PASSWORD;

    this.transporter = nodemailerModule.createTransport({
      host,
      port,
      secure,
      auth: user && password ? { user, pass: password } : undefined,
    });
  }

  async sendEmailVerification(input: SendEmailVerificationInput) {
    if (!this.transporter) {
      throw new ServiceUnavailableException('SMTP is not configured');
    }
    if (!this.from) {
      throw new ServiceUnavailableException('SMTP_FROM is not configured');
    }

    const subject = 'Verify your email for DressCode';
    const text = [
      'Please verify your email address to continue using DressCode.',
      '',
      `Verification link: ${input.verifyUrl}`,
      '',
      'If you did not request this email, you can ignore it.',
    ].join('\n');

    const html = `
      <p>Please verify your email address to continue using DressCode.</p>
      <p><a href="${input.verifyUrl}">Verify email</a></p>
      <p>If you did not request this email, you can ignore it.</p>
    `;

    await this.transporter.sendMail({
      from: this.from,
      to: input.to,
      subject,
      text,
      html,
    });
  }

  private parseBoolean(raw: string | undefined, fallback: boolean): boolean {
    if (!raw) {
      return fallback;
    }

    const normalized = raw.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }

    return fallback;
  }

  private resolveNodemailerModule():
    | {
        createTransport(config: Record<string, unknown>): MailTransport;
      }
    | null {
    try {
      const loaded = require('nodemailer') as {
        createTransport?: (config: Record<string, unknown>) => MailTransport;
      };

      if (typeof loaded.createTransport !== 'function') {
        return null;
      }

      return {
        createTransport: loaded.createTransport,
      };
    } catch {
      return null;
    }
  }
}
