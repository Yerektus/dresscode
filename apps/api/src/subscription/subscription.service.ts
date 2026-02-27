import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Subscription } from '../entities/subscription.entity';
import { CreditPurchase } from '../entities/credit-purchase.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { WebkassaWebhookDto } from './dto/webhook.dto';
import * as crypto from 'crypto';

const CREDIT_PACKAGES = {
  credits_20: {
    code: 'credits_20',
    credits: 20,
    price_kzt: 2000,
    amount_kzt: 2000,
  },
  credits_50: {
    code: 'credits_50',
    credits: 50,
    price_kzt: 5000,
    amount_kzt: 5000,
  },
  credits_100: {
    code: 'credits_100',
    credits: 100,
    price_kzt: 10000,
    amount_kzt: 10000,
  },
} as const;

type CreditPackageCode = keyof typeof CREDIT_PACKAGES;

@Injectable()
export class SubscriptionService {
  private readonly webhookSecret = process.env.WEBKASSA_WEBHOOK_SECRET ?? 'dev-webhook-secret';

  constructor(
    @InjectRepository(Subscription)
    private readonly repo: Repository<Subscription>,
    @InjectRepository(CreditPurchase)
    private readonly purchaseRepo: Repository<CreditPurchase>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async getByUser(userId: string) {
    const subscription = await this.ensureBillingAccount(userId);
    return this.toBillingState(subscription);
  }

  async createPayment(userId: string, dto: CreatePaymentDto) {
    const creditPackage = CREDIT_PACKAGES[dto.package_code as CreditPackageCode];
    if (!creditPackage) {
      throw new BadRequestException('Invalid package code');
    }

    const subscription = await this.ensureBillingAccount(userId);

    const externalPaymentId = crypto.randomUUID();
    const purchase = this.purchaseRepo.create({
      user_id: userId,
      external_payment_id: externalPaymentId,
      package_code: creditPackage.code,
      credits_amount: creditPackage.credits,
      amount_kzt: creditPackage.amount_kzt,
      status: 'pending',
    });
    await this.purchaseRepo.save(purchase);

    subscription.external_payment_id = externalPaymentId;
    subscription.status = 'pending';
    await this.repo.save(subscription);

    return {
      payment_url: `https://pay.webkassa.kz/checkout/${externalPaymentId}`,
      external_payment_id: externalPaymentId,
      credits: creditPackage.credits,
      price_kzt: creditPackage.price_kzt,
    };
  }

  async handleWebhook(dto: WebkassaWebhookDto) {
    this.verifySignature(dto);

    const purchase = await this.purchaseRepo.findOne({
      where: { external_payment_id: dto.payment_id },
    });
    if (!purchase) {
      throw new NotFoundException('Credit purchase not found for payment');
    }

    if (dto.status === 'paid') {
      await this.dataSource.transaction(async (manager) => {
        await manager
          .createQueryBuilder()
          .insert()
          .into(Subscription)
          .values({
            user_id: purchase.user_id,
            provider: 'webkassa',
            status: 'active',
            plan_code: 'free',
            current_period_end: null,
            credits_balance: 10,
          })
          .orIgnore()
          .execute();

        const markPaidResult = await manager
          .createQueryBuilder()
          .update(CreditPurchase)
          .set({ status: 'paid' })
          .where('id = :id', { id: purchase.id })
          .andWhere("status != 'paid'")
          .execute();

        if (!markPaidResult.affected) {
          return;
        }

        await manager
          .createQueryBuilder()
          .update(Subscription)
          .set({
            status: 'active',
            plan_code: 'free',
            current_period_end: null,
            external_payment_id: purchase.external_payment_id,
            credits_balance: () => `credits_balance + ${purchase.credits_amount}`,
          })
          .where('user_id = :userId', { userId: purchase.user_id })
          .execute();
      });
    } else if (dto.status === 'cancelled') {
      await this.purchaseRepo
        .createQueryBuilder()
        .update(CreditPurchase)
        .set({ status: 'cancelled' })
        .where('id = :id', { id: purchase.id })
        .andWhere("status != 'paid'")
        .execute();
    }

    return { received: true };
  }

  private async ensureBillingAccount(userId: string): Promise<Subscription> {
    let subscription = await this.repo.findOne({ where: { user_id: userId } });
    if (!subscription) {
      subscription = this.repo.create({
        user_id: userId,
        provider: 'webkassa',
        status: 'active',
        plan_code: 'free',
        current_period_end: null,
        external_payment_id: null,
        credits_balance: 10,
      });
      return this.repo.save(subscription);
    }

    return subscription;
  }

  private toBillingState(subscription: Subscription) {
    const creditPackage = CREDIT_PACKAGES.credits_50;
    const availablePackages = Object.values(CREDIT_PACKAGES);

    return {
      id: subscription.id,
      user_id: subscription.user_id,
      provider: subscription.provider,
      status: 'active',
      current_period_end: null,
      external_payment_id: subscription.external_payment_id,
      plan_code: 'free',
      credits_balance: subscription.credits_balance,
      credit_pack: {
        code: creditPackage.code,
        credits: creditPackage.credits,
        price_kzt: creditPackage.price_kzt,
      },
      credit_packs: availablePackages.map((pack) => ({
        code: pack.code,
        credits: pack.credits,
        price_kzt: pack.price_kzt,
      })),
      billing_mode: 'credits_only',
      premium_deprecated: true,
      created_at: subscription.created_at,
      updated_at: subscription.updated_at,
    };
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
