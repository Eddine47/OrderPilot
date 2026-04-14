import api from './client';
import type { Product } from '../types';

export interface ProductPayload {
  name: string;
  unit?: string;
  unit_price_ht?: number;
  vat_rate?: number;
}

export const productsApi = {
  list:   () => api.get<Product[]>('/products'),
  get:    (id: number) => api.get<Product>(`/products/${id}`),
  create: (p: ProductPayload) => api.post<Product>('/products', p),
  update: (id: number, p: Partial<ProductPayload>) => api.put<Product>(`/products/${id}`, p),
  delete: (id: number) => api.delete(`/products/${id}`),
};
