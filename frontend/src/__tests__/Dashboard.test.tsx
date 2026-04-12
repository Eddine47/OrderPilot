import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import Dashboard from '../pages/Dashboard';
import { deliveriesApi } from '../api/deliveries';
import { storesApi } from '../api/stores';
import { recurringApi } from '../api/recurring';

vi.mock('../api/deliveries');
vi.mock('../api/stores');
vi.mock('../api/recurring');

const mockDeliveries = [
  {
    id: 1, store_id: 1, store_name: 'Leclerc', delivery_date: '2026-04-10',
    delivery_number: 1, quantity_delivered: 10, quantity_recovered: 2,
    total_quantity: 8, status: 'pending', user_id: 1, created_at: '', updated_at: '',
  },
  {
    id: 2, store_id: 2, store_name: 'Intermarché', delivery_date: '2026-04-10',
    delivery_number: 1, quantity_delivered: 15, quantity_recovered: 0,
    total_quantity: 15, status: 'ok', user_id: 1, created_at: '', updated_at: '',
  },
];

const mockMonthlyTotal = {
  month: 4, year: 2026, deliveries: 10, qty_delivered: 100, qty_recovered: 10, total_quantity: 90,
};

function renderDashboard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  // Mock localStorage token so AuthContext doesn't redirect
  vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('fake-token');

  vi.mocked(deliveriesApi.today).mockResolvedValue({ data: mockDeliveries } as never);
  vi.mocked(deliveriesApi.monthlyTotal).mockResolvedValue({ data: mockMonthlyTotal } as never);
  vi.mocked(storesApi.list).mockResolvedValue({ data: [] } as never);

  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <Dashboard />
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows today\'s deliveries', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Leclerc')).toBeInTheDocument();
      expect(screen.getByText('Intermarché')).toBeInTheDocument();
    });
  });

  it('shows monthly total stat card', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('90')).toBeInTheDocument();
    });
  });

  it('shows pending and ok deliveries', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Leclerc')).toBeInTheDocument();
    });
    // 2 out of 2 shown
    expect(screen.getByText('1 / 2 validées')).toBeInTheDocument();
  });

  it('opens create delivery modal', async () => {
    renderDashboard();
    await waitFor(() => screen.getByText('+ Nouvelle livraison'));
    fireEvent.click(screen.getByText('+ Nouvelle livraison'));
    await waitFor(() => {
      expect(screen.getByText('Nouvelle livraison')).toBeInTheDocument();
    });
  });

  it('calls generate recurring on button click', async () => {
    vi.mocked(recurringApi.generate).mockResolvedValue({ data: { message: 'ok', created: 1 } } as never);
    renderDashboard();
    await waitFor(() => screen.getByText(/Générer récurrentes/));
    fireEvent.click(screen.getByText(/Générer récurrentes/));
    await waitFor(() => {
      expect(recurringApi.generate).toHaveBeenCalled();
    });
  });
});
