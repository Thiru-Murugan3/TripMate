export interface User {
  id: number;
  name: string;
  email: string;
  mobile?: string;
  avatarUrl?: string;
  systemRole: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'INACTIVE';
  createdAt?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType?: string;
  expiresIn?: number;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  mobile: string;
}

export interface RegistrationPendingResponse {
  message: string;
  email: string;
  expiresIn: number;
}

export interface VerifyEmailRequest {
  email: string;
  otp: string;
}

export interface ResendEmailOtpRequest {
  email: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface ApiErrorResponse {
  timestamp: string;
  status: number;
  code: string;
  message: string;
  path: string;
  fieldErrors?: Record<string, string>;
}
