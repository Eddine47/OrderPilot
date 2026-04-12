import api from './client';
import type { User } from '../types';

export interface LoginPayload { email: string; password: string; }
export interface RegisterPayload extends LoginPayload {
  name: string;
  company_name?: string;
  company_address?: string;
  company_siret?: string;
}
export interface AuthResponse { token: string; user: User; }

export const authApi = {
  login:    (p: LoginPayload)    => api.post<AuthResponse>('/auth/login', p),
  register: (p: RegisterPayload) => api.post<AuthResponse>('/auth/register', p),
  me:       ()                   => api.get<User>('/auth/me'),
  updateMe: (p: Partial<RegisterPayload>) => api.put<User>('/auth/me', p),
};
