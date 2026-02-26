const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api';
export type BodyGender = 'female' | 'male';
export type BodyShape = 'hourglass' | 'pear' | 'apple' | 'rectangle' | 'inverted_triangle';
export type CreditPackageCode = 'credits_50';

let authToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export interface AuthUser {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  access_token: string;
  user: AuthUser;
}

export interface BodyProfileResponse {
  id: string;
  user_id: string;
  height_cm: number;
  weight_kg: number;
  chest_cm?: number | null;
  waist_cm?: number | null;
  hips_cm?: number | null;
  sleeve_cm?: number | null;
  inseam_cm?: number | null;
  body_shape?: BodyShape | null;
  gender?: BodyGender | null;
  created_at: string;
  updated_at: string;
}

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
    price_usd: number;
  };
  billing_mode: 'credits_only';
  premium_deprecated: true;
  created_at: string;
  updated_at: string;
}

export interface TryOnRequestResponse {
  id: string;
  user_id: string;
  mannequin_version_id: string;
  garment_image_url: string;
  category: string;
  selected_size: string;
  chest_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  created_at: string;
}

export interface TryOnResultResponse {
  id: string;
  request_id: string;
  result_image_url: string;
  fit_probability: number;
  fit_breakdown_json: Record<string, number> | null;
  model_version: string;
  created_at: string;
}

export interface TryOnHistoryItemResponse extends TryOnRequestResponse {
  result: TryOnResultResponse | null;
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
  return request<AuthResponse>('/auth/register', {
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

// Body Profile
export function getBodyProfile() {
  return request<BodyProfileResponse>('/body-profile');
}

export function saveBodyProfile(data: {
  height_cm: number;
  weight_kg: number;
  chest_cm?: number;
  waist_cm?: number;
  hips_cm?: number;
  sleeve_cm?: number;
  inseam_cm?: number;
  body_shape?: string;
  gender?: BodyGender;
}) {
  return request('/body-profile', {
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
export function createTryOn(data: {
  garment_image: string;
  category: string;
  selected_size: string;
  mannequin_version_id: string;
  chest_cm?: number;
  waist_cm?: number;
  hips_cm?: number;
}) {
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
  return request<{ payment_url: string; external_payment_id: string; credits: number; price_usd: number }>(
    '/subscription/create-payment',
    {
      method: 'POST',
      body: JSON.stringify({ package_code }),
    },
  );
}
