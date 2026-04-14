import api from './client';
import type { PrivateSale, PaymentMethod } from '../types';

export interface SaleItemPayload {
  product_id: number | null;
  quantity: number;
  unit_price_ht: number | null;
  vat_rate: number | null;
}

export interface SalePayload {
  sale_date: string;
  payment_method: PaymentMethod;
  notes?: string;
  items: SaleItemPayload[];
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
