import api from './client';
import type { RecurringRule } from '../types';

export interface RecurringPayload {
  store_id: number;
  day_of_month: number;
  quantity: number;
}

export const recurringApi = {
  list:     () =>
    api.get<RecurringRule[]>('/recurring'),

  create:   (p: RecurringPayload) =>
    api.post<RecurringRule>('/recurring', p),

  update:   (id: number, p: Partial<RecurringPayload> & { is_active?: boolean }) =>
    api.put<RecurringRule>(`/recurring/${id}`, p),

  delete:   (id: number) =>
    api.delete(`/recurring/${id}`),

  generate: (month: number, year: number) =>
    api.post<{ message: string; created: number }>('/recurring/generate', { month, year }),
};
