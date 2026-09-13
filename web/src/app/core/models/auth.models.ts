export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  userId: number;
  name: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface RegisterRequest {
  name: string;
  email: string;
  mobile: string;
  password: string;
}

export interface RegisterResponse {
  id: number;
  name: string;
  email: string;
  message: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface LogoutResponse {
  message: string;
}

export interface ApiErrorResponse {
  timestamp?: string;
  status?: number;
  code?: string;
  message?: string;
  path?: string;
  validationErrors?: Record<string, string>;
}

export interface AuthSession {
  userId: number;
  name: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}
