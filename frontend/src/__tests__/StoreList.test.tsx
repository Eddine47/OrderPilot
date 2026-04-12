import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import StoreList from '../pages/StoreList';
import { storesApi } from '../api/stores';
import { recurringApi } from '../api/recurring';

vi.mock('../api/stores');
vi.mock('../api/recurring');

const mockStores = [
  { id: 1, name: 'Leclerc',     user_id: 1, is_active: true, created_at: '', delivery_count: 5, total_quantity: 45 },
  { id: 2, name: 'Intermarché', user_id: 1, is_active: true, created_at: '', delivery_count: 3, total_quantity: 30 },
];

function renderStoreList() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('fake-token');
  vi.mocked(storesApi.list).mockResolvedValue({ data: mockStores } as never);
  vi.mocked(recurringApi.list).mockResolvedValue({ data: [] } as never);

  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <StoreList />
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe('StoreList', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders list of stores', async () => {
    renderStoreList();
    await waitFor(() => {
      expect(screen.getByText('Leclerc')).toBeInTheDocument();
      expect(screen.getByText('Intermarché')).toBeInTheDocument();
    });
  });

  it('shows delivery count and total for each store', async () => {
    renderStoreList();
    await waitFor(() => {
      expect(screen.getByText('5 livraisons')).toBeInTheDocument();
      expect(screen.getByText('Total : 45')).toBeInTheDocument();
    });
  });

  it('opens create store modal', async () => {
    renderStoreList();
    await waitFor(() => screen.getByText('+ Nouvelle enseigne'));
    fireEvent.click(screen.getByText('+ Nouvelle enseigne'));
    await waitFor(() => {
      expect(screen.getByText('Nouvelle enseigne')).toBeInTheDocument();
    });
  });

  it('opens recurring modal', async () => {
    renderStoreList();
    await waitFor(() => screen.getByText(/Récurrentes/));
    fireEvent.click(screen.getByText(/Récurrentes/));
    await waitFor(() => {
      expect(screen.getByText(/récurrentes/i)).toBeInTheDocument();
    });
  });

  it('calls delete API on confirm', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(storesApi.delete).mockResolvedValue({ data: {} } as never);
    renderStoreList();

    await waitFor(() => screen.getAllByTitle('Supprimer'));
    fireEvent.click(screen.getAllByTitle('Supprimer')[0]);

    await waitFor(() => {
      expect(storesApi.delete).toHaveBeenCalledWith(1);
    });
  });
});
