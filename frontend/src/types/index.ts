export interface User {
  id: number;
  email: string;
  name: string;
  company_name: string;
  company_address?: string;
  company_siret?: string;
  created_at: string;
}

export interface Store {
  id: number;
  user_id: number;
  name: string;
  address?: string;
  contact_name?: string;
  contact_phone?: string;
  is_active: boolean;
  created_at: string;
  // aggregated fields from list endpoint
  delivery_count?: number;
  total_quantity?: number;
}

export type DeliveryStatus = 'pending' | 'ok';

export interface Delivery {
  id: number;
  user_id: number;
  store_id: number;
  store_name: string;
  delivery_date: string;      // ISO date "YYYY-MM-DD"
  delivery_number: number;
  quantity_delivered: number;
  quantity_recovered: number;
  total_quantity: number;     // computed: delivered - recovered
  is_recurring: boolean;
  status: DeliveryStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface RecurringRule {
  id: number;
  user_id: number;
  store_id: number;
  store_name: string;
  day_of_month: number;       // 1-31
  quantity: number;
  is_active: boolean;
  created_at: string;
}

export interface MonthlyTotal {
  month: number;
  year: number;
  deliveries: number;
  qty_delivered: number;
  qty_recovered: number;
  total_quantity: number;
}

export interface MonthlySummaryStore {
  id: number;
  name: string;
  deliveries: number;
  qty_delivered: number;
  qty_recovered: number;
  total_quantity: number;
}

export interface MonthlySummary {
  month: number;
  year: number;
  stores: MonthlySummaryStore[];
  grand_total: number;
}

export interface MonthlySlip {
  store: Store;
  user: Pick<User, 'name' | 'company_name' | 'company_address' | 'company_siret'>;
  month: number;
  year: number;
  slip_number: number;
  deliveries: Delivery[];
  grand_total: number;
}

export const DAY_NAMES = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
export const DAY_NAMES_FULL = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
export const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];
