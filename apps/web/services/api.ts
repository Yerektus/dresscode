import type {
  AuthResponseDto,
  BodyGender,
  BodyProfileDto,
  BodyShape,
  CreateBodyProfileDto,
  CreateTryOnRequestDto,
  CreditPackageCode,
  MessageResponseDto,
  PendingEmailVerificationResponseDto,
  RegisterResponseDto,
  ResendVerificationDto,
  UserDto,
  VerifyEmailDto,
  TryOnHistoryItemDto,
  TryOnRequestDto,
  TryOnResultDto,
} from '@repo/core';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api';
export type { BodyGender, BodyShape, CreditPackageCode };
export type { CreateBodyProfileDto, CreateTryOnRequestDto, ResendVerificationDto, VerifyEmailDto };

let authToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export type AuthUser = UserDto;
export type AuthResponse = AuthResponseDto;
export type RegisterResponse = RegisterResponseDto;

export type BodyProfileResponse = BodyProfileDto;

export interface SubscriptionResponse {
  id: string;
  user_id: string;
  provider: string;
  plan_code: string;
  status: string;
  current_period_end: string | null;
  external_payment_id: string | null;
  credits_balance: number;
  credit_pack: {
    code: CreditPackageCode;
    credits: number;
    price_kzt: number;
  };
  credit_packs: Array<{
    code: CreditPackageCode;
    credits: number;
    price_kzt: number;
  }>;
  billing_mode: 'credits_only';
  premium_deprecated: true;
  created_at: string;
  updated_at: string;
}

export type TryOnRequestResponse = TryOnRequestDto;
export type TryOnResultResponse = TryOnResultDto;
export type TryOnHistoryItemResponse = TryOnHistoryItemDto;

export type MediaUploadPurpose = 'face_image' | 'garment_image';

export interface PresignUploadResponse {
  upload_url: string;
  asset_key: string;
  asset_url: string;
  expires_at: string;
  required_headers: Record<string, string>;
}

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

function tryParseJson(raw: string): unknown {
  if (!raw.trim()) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) ?? {}),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const rawBody = await res.text();
  const parsedBody = tryParseJson(rawBody);

  if (!res.ok) {
    const body = (parsedBody && parsedBody !== undefined ? parsedBody : {}) as {
      message?: string | string[];
    };
    const message =
      Array.isArray(body.message) ? body.message.join(', ') : body.message ?? 'Request failed';

    if (res.status === 401) {
      unauthorizedHandler?.();
    }

    throw new ApiError(res.status, message);
  }

  if (parsedBody === undefined) {
    throw new ApiError(res.status, 'Invalid server response');
  }

  return parsedBody as T;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Auth
export function register(email: string, password: string, password_confirmation: string) {
  return request<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, password_confirmation }),
  });
}

export function login(email: string, password: string) {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function getMe() {
  return request<AuthUser>('/auth/me');
}

export function updateMeEmail(email: string) {
  return request<AuthUser>('/auth/me/email', {
    method: 'PATCH',
    body: JSON.stringify({ email }),
  });
}

export function updateMePassword(
  current_password: string,
  new_password: string,
  new_password_confirmation: string,
) {
  return request<{ message: string }>('/auth/me/password', {
    method: 'PATCH',
    body: JSON.stringify({
      current_password,
      new_password,
      new_password_confirmation,
    }),
  });
}

export function verifyEmail(token: string) {
  const payload: VerifyEmailDto = { token };
  return request<AuthResponse>('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function resendVerification(email: string) {
  const payload: ResendVerificationDto = { email };
  return request<MessageResponseDto>('/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function resendPendingEmailVerification() {
  return request<PendingEmailVerificationResponseDto>('/auth/me/email/resend-verification', {
    method: 'POST',
  });
}

// Body Profile
export function getBodyProfile() {
  return request<BodyProfileResponse>('/body-profile');
}

export function saveBodyProfile(data: CreateBodyProfileDto) {
  return request('/body-profile', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function createPresignedUpload(data: {
  purpose: MediaUploadPurpose;
  content_type: string;
  size_bytes: number;
}) {
  return request<PresignUploadResponse>('/media/presign-upload', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Mannequin
export function generateMannequin() {
  return request<{ id: string; front_image_url: string }>('/mannequin/generate', {
    method: 'POST',
  });
}

export function getActiveMannequin() {
  return request<{ id: string; front_image_url: string; is_active: boolean }>('/mannequin/active');
}

// Try-On
export function createTryOn(data: CreateTryOnRequestDto) {
  return request<{
    request: TryOnRequestResponse;
    result: TryOnResultResponse;
  }>('/tryon', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getTryOnHistory() {
  return request<TryOnHistoryItemResponse[]>('/tryon/history');
}

export function getTryOnById(requestId: string) {
  return request<TryOnHistoryItemResponse>(`/tryon/${requestId}`);
}

// Subscription
export function getSubscription() {
  return request<SubscriptionResponse>('/subscription');
}

export function createPayment(package_code: CreditPackageCode) {
  return request<{ payment_url: string; external_payment_id: string; credits: number; price_kzt: number }>(
    '/subscription/create-payment',
    {
      method: 'POST',
      body: JSON.stringify({ package_code }),
    },
  );
}
