import api from './client';
import type { PrivateSale, PaymentMethod } from '../types';

export interface SalePayload {
  sale_date: string;
  quantity: number;
  payment_method: PaymentMethod;
  notes?: string;
}

export const salesApi = {
  list: (month?: number, year?: number) =>
    api.get<PrivateSale[]>('/sales', { params: { month, year } }),

  create: (p: SalePayload) =>
    api.post<PrivateSale>('/sales', p),

  update: (id: number, p: Partial<SalePayload>) =>
    api.put<PrivateSale>(`/sales/${id}`, p),

  delete: (id: number) =>
    api.delete(`/sales/${id}`),
};
