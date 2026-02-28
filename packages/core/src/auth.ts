export interface UserDto {
  id: string;
  email: string;
  email_verified: boolean;
  email_verified_at: string | null;
  pending_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  password_confirmation: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponseDto {
  access_token: string;
  user: UserDto;
}

export interface RegisterResponseDto {
  message: string;
  verification_required: true;
}

export interface VerifyEmailDto {
  token: string;
}

export interface ResendVerificationDto {
  email: string;
}

export interface MessageResponseDto {
  message: string;
}

export interface PendingEmailVerificationResponseDto extends MessageResponseDto {
  pending_email: string;
}
