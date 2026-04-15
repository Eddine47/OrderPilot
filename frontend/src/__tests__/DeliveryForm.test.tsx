import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DeliveryForm from '../components/DeliveryForm';
import type { Store } from '../types';

vi.mock('../api/products', () => ({
  productsApi: {
    list: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

const mockStores: Store[] = [
  { id: 1, name: 'Leclerc',     user_id: 1, is_active: true, has_returns: true,  created_at: '' },
  { id: 2, name: 'Intermarché', user_id: 1, is_active: true, has_returns: false, created_at: '' },
];

function renderForm(props: Partial<React.ComponentProps<typeof DeliveryForm>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <DeliveryForm
        stores={mockStores}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        {...props}
      />
    </QueryClientProvider>
  );
}

function getNumberInputs(container: HTMLElement) {
  return Array.from(container.querySelectorAll('input[type="number"]')) as HTMLInputElement[];
}

describe('DeliveryForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with default values', () => {
    renderForm();
    expect(screen.getByText('Enseigne *')).toBeInTheDocument();
    expect(screen.getByText('Qté livrée')).toBeInTheDocument();
    expect(screen.getByText('Qté récupérée')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /créer/i })).toBeInTheDocument();
  });

  it('shows total quantity as delivered - recovered', async () => {
    const { container } = renderForm();
    const [qtyInput, recInput] = getNumberInputs(container);

    await userEvent.clear(qtyInput);
    await userEvent.type(qtyInput, '20');
    await userEvent.clear(recInput);
    await userEvent.type(recInput, '5');

    await waitFor(() => {
      expect(screen.getByText('15')).toBeInTheDocument();
    });
  });

  it('calls onSubmit with correct payload', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = renderForm({ onSubmit });

    const [qtyInput] = getNumberInputs(container);
    await userEvent.clear(qtyInput);
    await userEvent.type(qtyInput, '30');

    fireEvent.click(screen.getByRole('button', { name: /créer/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          store_id: 1,
          items: expect.arrayContaining([
            expect.objectContaining({ quantity_delivered: 30 }),
          ]),
        })
      );
    });
  });

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = vi.fn();
    renderForm({ onCancel });
    fireEvent.click(screen.getByRole('button', { name: /annuler/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows edit mode when initial data provided', () => {
    renderForm({
      initial: {
        store_id: 1,
        delivery_date: '2026-03-10',
        items: [{
          id: 1, delivery_id: 1, position: 0, product_id: null, product_name: null,
          quantity_delivered: 12, quantity_recovered: 3,
          unit_price_ht: 0, vat_rate: 0,
        }],
      },
    });
    expect(screen.getByRole('button', { name: /modifier/i })).toBeInTheDocument();
  });

  it('shows error from API', async () => {
    const onSubmit = vi.fn().mockRejectedValue({
      response: { data: { error: 'Enseigne introuvable' } },
    });
    renderForm({ onSubmit });
    fireEvent.click(screen.getByRole('button', { name: /créer/i }));
    await waitFor(() => {
      expect(screen.getByText('Enseigne introuvable')).toBeInTheDocument();
    });
  });
});
