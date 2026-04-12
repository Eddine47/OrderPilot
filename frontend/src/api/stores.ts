import api from './client';
import type { Store, MonthlySummary, MonthlySlip } from '../types';

export interface StorePayload {
  name: string;
  address?: string;
  contact_name?: string;
  contact_phone?: string;
}

export const storesApi = {
  list:    (search?: string) =>
    api.get<Store[]>('/stores', { params: search ? { search } : undefined }),

  get:     (id: number) =>
    api.get<Store>(`/stores/${id}`),

  create:  (p: StorePayload) =>
    api.post<Store>('/stores', p),

  update:  (id: number, p: Partial<StorePayload>) =>
    api.put<Store>(`/stores/${id}`, p),

  delete:  (id: number) =>
    api.delete(`/stores/${id}`),

  summary: (month?: number, year?: number) =>
    api.get<MonthlySummary>('/stores/summary', { params: { month, year } }),

  slip:    (id: number, month?: number, year?: number) =>
    api.get<MonthlySlip>(`/stores/${id}/slip`, { params: { month, year } }),
};
