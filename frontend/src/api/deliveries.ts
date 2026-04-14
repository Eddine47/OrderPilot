import api from './client';
import type { Delivery, DeliveryStatus, MonthlyTotal, UpcomingDay } from '../types';

export interface DeliveryPayload {
  store_id: number;
  delivery_date: string;
  quantity_delivered: number;
  quantity_recovered?: number;
  order_reference?: string;
  notes?: string;
  product_id?: number | null;
  unit_price_ht?: number | null;
  vat_rate?: number | null;
}

export interface DeliveryFilters {
  store_id?: number;
  date?: string;
  month?: number;
  year?: number;
  status?: DeliveryStatus;
}

export const deliveriesApi = {
  list:    (filters?: DeliveryFilters) =>
    api.get<Delivery[]>('/deliveries', { params: filters }),

  today:   () =>
    api.get<Delivery[]>('/deliveries/today'),

  monthlyTotal: (month?: number, year?: number) =>
    api.get<MonthlyTotal>('/deliveries/monthly-total', { params: { month, year } }),

  get:     (id: number) =>
    api.get<Delivery>(`/deliveries/${id}`),

  create:  (p: DeliveryPayload) =>
    api.post<Delivery>('/deliveries', p),

  update:  (id: number, p: Partial<DeliveryPayload> & { status?: DeliveryStatus }) =>
    api.put<Delivery>(`/deliveries/${id}`, p),

  patchStatus: (id: number, status: DeliveryStatus) =>
    api.patch<Delivery>(`/deliveries/${id}/status`, { status }),

  upcoming: (days = 7) =>
    api.get<UpcomingDay[]>('/deliveries/upcoming', { params: { days } }),

  delete:  (id: number) =>
    api.delete(`/deliveries/${id}`),
};
