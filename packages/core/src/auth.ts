export interface UserDto {
  id: string;
  email: string;
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
