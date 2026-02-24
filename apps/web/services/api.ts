const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api';

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
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

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.message ?? 'Request failed');
  }

  return res.json() as Promise<T>;
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
  return request<{ access_token: string; user: { id: string; email: string } }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, password_confirmation }),
  });
}

export function login(email: string, password: string) {
  return request<{ access_token: string; user: { id: string; email: string } }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

// Body Profile
export function getBodyProfile() {
  return request<{ id: string; height_cm: number; weight_kg: number }>('/body-profile');
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
}) {
  return request<{
    request_id: string;
    result_image_url: string;
    fit_probability: number;
    fit_breakdown_json: Record<string, number> | null;
  }>('/tryon', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getTryOnHistory() {
  return request<Array<{
    id: string;
    category: string;
    selected_size: string;
    created_at: string;
    result: {
      result_image_url: string;
      fit_probability: number;
    };
  }>>('/tryon/history');
}

// Subscription
export function getSubscription() {
  return request<{
    plan_code: string;
    status: string;
    current_period_end: string | null;
  }>('/subscription');
}

export function createPayment(plan_code: string) {
  return request<{ payment_url: string }>('/subscription/create-payment', {
    method: 'POST',
    body: JSON.stringify({ plan_code }),
  });
}
