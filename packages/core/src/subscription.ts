export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'pending';
export type PlanCode = 'free' | 'premium';

export interface SubscriptionDto {
  id: string;
  user_id: string;
  provider: 'webkassa';
  status: SubscriptionStatus;
  current_period_end?: string | null;
  external_payment_id?: string | null;
  plan_code: PlanCode;
  created_at: string;
  updated_at: string;
}

export interface CreatePaymentDto {
  plan_code: PlanCode;
}

export interface PaymentResponseDto {
  payment_url: string;
  external_payment_id: string;
}

export interface WebkassaWebhookDto {
  payment_id: string;
  status: string;
  signature: string;
}
