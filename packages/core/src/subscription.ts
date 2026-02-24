export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'pending';
export type PlanCode = 'free' | 'premium';
export type BillingMode = 'credits_only';
export type CreditPackageCode = 'credits_50';

export interface CreditPackDto {
  code: CreditPackageCode;
  credits: number;
  price_usd: number;
}

export interface SubscriptionDto {
  id: string;
  user_id: string;
  provider: 'webkassa';
  status: SubscriptionStatus;
  current_period_end?: string | null;
  external_payment_id?: string | null;
  plan_code: PlanCode;
  credits_balance: number;
  credit_pack: CreditPackDto;
  billing_mode: BillingMode;
  premium_deprecated: true;
  created_at: string;
  updated_at: string;
}

export interface CreatePaymentDto {
  package_code: CreditPackageCode;
}

export interface PaymentResponseDto {
  payment_url: string;
  external_payment_id: string;
  credits: number;
  price_usd: number;
}

export interface WebkassaWebhookDto {
  payment_id: string;
  status: string;
  signature: string;
}
