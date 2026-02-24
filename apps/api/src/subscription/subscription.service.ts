import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from '../entities/subscription.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { WebkassaWebhookDto } from './dto/webhook.dto';
import * as crypto from 'crypto';

@Injectable()
export class SubscriptionService {
  private readonly webhookSecret = process.env.WEBKASSA_WEBHOOK_SECRET ?? 'dev-webhook-secret';

  constructor(
    @InjectRepository(Subscription)
    private readonly repo: Repository<Subscription>,
  ) {}

  async getByUser(userId: string) {
    return this.repo.findOne({ where: { user_id: userId } });
  }

  async createPayment(userId: string, dto: CreatePaymentDto) {
    if (dto.plan_code !== 'premium') {
      throw new BadRequestException('Invalid plan code');
    }

    let subscription = await this.repo.findOne({ where: { user_id: userId } });
    if (!subscription) {
      subscription = this.repo.create({
        user_id: userId,
        provider: 'webkassa',
        status: 'pending',
        plan_code: 'free',
      });
      await this.repo.save(subscription);
    }

    const externalPaymentId = crypto.randomUUID();

    subscription.external_payment_id = externalPaymentId;
    subscription.status = 'pending';
    await this.repo.save(subscription);

    // In production, this would call Webkassa API to create a payment session
    return {
      payment_url: `https://pay.webkassa.kz/checkout/${externalPaymentId}`,
      external_payment_id: externalPaymentId,
    };
  }

  async handleWebhook(dto: WebkassaWebhookDto) {
    this.verifySignature(dto);

    const subscription = await this.repo.findOne({
      where: { external_payment_id: dto.payment_id },
    });
    if (!subscription) {
      throw new NotFoundException('Subscription not found for payment');
    }

    if (dto.status === 'paid') {
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      subscription.status = 'active';
      subscription.plan_code = 'premium';
      subscription.current_period_end = periodEnd;
    } else if (dto.status === 'cancelled') {
      subscription.status = 'cancelled';
    }

    await this.repo.save(subscription);
    return { received: true };
  }

  private verifySignature(dto: WebkassaWebhookDto) {
    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(`${dto.payment_id}:${dto.status}`)
      .digest('hex');

    if (dto.signature !== expected) {
      throw new BadRequestException('Invalid webhook signature');
    }
  }
}
