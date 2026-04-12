import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeliveryForm from '../components/DeliveryForm';
import type { Store } from '../types';

const mockStores: Store[] = [
  { id: 1, name: 'Leclerc',     user_id: 1, is_active: true, created_at: '' },
  { id: 2, name: 'Intermarché', user_id: 1, is_active: true, created_at: '' },
];

describe('DeliveryForm', () => {
  it('renders with default values', () => {
    render(
      <DeliveryForm
        stores={mockStores}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('Enseigne *')).toBeInTheDocument();
    expect(screen.getByText('Qté livrée *')).toBeInTheDocument();
    expect(screen.getByText('Qté récupérée')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /créer/i })).toBeInTheDocument();
  });

  it('shows total quantity as delivered - recovered', async () => {
    render(
      <DeliveryForm stores={mockStores} onSubmit={vi.fn()} onCancel={vi.fn()} />
    );
    const qtyInput = screen.getByLabelText(/qté livrée/i) as HTMLInputElement;
    const recInput = screen.getByLabelText(/qté récupérée/i) as HTMLInputElement;

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
    render(
      <DeliveryForm stores={mockStores} onSubmit={onSubmit} onCancel={vi.fn()} />
    );

    const qtyInput = screen.getByLabelText(/qté livrée/i) as HTMLInputElement;
    await userEvent.clear(qtyInput);
    await userEvent.type(qtyInput, '30');

    fireEvent.click(screen.getByRole('button', { name: /créer/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ quantity_delivered: 30, store_id: 1 })
      );
    });
  });

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = vi.fn();
    render(
      <DeliveryForm stores={mockStores} onSubmit={vi.fn()} onCancel={onCancel} />
    );
    fireEvent.click(screen.getByRole('button', { name: /annuler/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows edit mode when initial data provided', () => {
    render(
      <DeliveryForm
        stores={mockStores}
        initial={{ store_id: 1, delivery_date: '2026-03-10', quantity_delivered: 12, quantity_recovered: 3 }}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /modifier/i })).toBeInTheDocument();
  });

  it('shows error from API', async () => {
    const onSubmit = vi.fn().mockRejectedValue({
      response: { data: { error: 'Enseigne introuvable' } },
    });
    render(
      <DeliveryForm stores={mockStores} onSubmit={onSubmit} onCancel={vi.fn()} />
    );
    fireEvent.click(screen.getByRole('button', { name: /créer/i }));
    await waitFor(() => {
      expect(screen.getByText('Enseigne introuvable')).toBeInTheDocument();
    });
  });
});
