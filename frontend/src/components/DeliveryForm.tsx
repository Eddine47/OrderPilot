import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { productsApi } from '../api/products';
import type { Delivery, Store, Product } from '../types';

interface ItemRow {
  product_id: number | null;
  quantity_delivered: number;
  quantity_recovered: number;
  unit_price_ht: string;
  vat_rate: string;
}

interface SubmitData {
  store_id: number;
  delivery_date: string;
  order_reference: string;
  notes: string;
  items: {
    product_id: number | null;
    quantity_delivered: number;
    quantity_recovered: number;
    unit_price_ht: number | null;
    vat_rate: number | null;
  }[];
}

interface Props {
  stores: Store[];
  initial?: Partial<Delivery>;
  onSubmit: (data: SubmitData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

function emptyRow(): ItemRow {
  return {
    product_id: null,
    quantity_delivered: 0,
    quantity_recovered: 0,
    unit_price_ht: '',
    vat_rate: '',
  };
}

function rowFromDelivery(d: Partial<Delivery>): ItemRow[] {
  if (d.items && d.items.length > 0) {
    return d.items.map((it) => ({
      product_id: it.product_id ?? null,
      quantity_delivered: it.quantity_delivered ?? 0,
      quantity_recovered: it.quantity_recovered ?? 0,
      unit_price_ht: it.unit_price_ht != null ? String(it.unit_price_ht) : '',
      vat_rate: it.vat_rate != null ? String(it.vat_rate) : '',
    }));
  }
  return [emptyRow()];
}

export default function DeliveryForm({ stores, initial, onSubmit, onCancel, loading }: Props) {
  const today = new Date().toISOString().slice(0, 10);

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn:  () => productsApi.list().then((r) => r.data),
  });

  const [storeId, setStoreId] = useState(initial?.store_id ?? (stores[0]?.id || 0));
  const selectedStore = stores.find((s) => s.id === storeId);
  const showReturns = selectedStore?.has_returns ?? false;

  const [date, setDate]           = useState((initial?.delivery_date ?? today).slice(0, 10));
  const [orderRef, setOrderRef]   = useState(initial?.order_reference ?? '');
  const [notes, setNotes]         = useState(initial?.notes ?? '');
  const [items, setItems]         = useState<ItemRow[]>(initial ? rowFromDelivery(initial) : [emptyRow()]);
  const [error, setError]         = useState('');

  useEffect(() => {
    if (!initial && stores.length > 0) setStoreId(stores[0].id);
  }, [stores, initial]);

  function updateItem(idx: number, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function handleProductChange(idx: number, value: string) {
    if (value === '') {
      updateItem(idx, { product_id: null });
      return;
    }
    const pid = Number(value);
    const p: Product | undefined = products.find((x) => x.id === pid);
    updateItem(idx, {
      product_id: pid,
      unit_price_ht: p ? String(p.unit_price_ht) : '',
      vat_rate: p ? String(p.vat_rate) : '',
    });
  }

  function addRow() { setItems((p) => [...p, emptyRow()]); }
  function removeRow(idx: number) {
    setItems((p) => (p.length === 1 ? p : p.filter((_, i) => i !== idx)));
  }

  const totalDelivered = items.reduce((s, it) => s + (Number(it.quantity_delivered) || 0), 0);
  const totalRecovered = items.reduce((s, it) => s + (Number(it.quantity_recovered) || 0), 0);
  const totalQty = totalDelivered - totalRecovered;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!storeId) { setError('Sélectionnez une enseigne'); return; }
    if (items.length === 0) { setError('Ajoutez au moins une ligne produit'); return; }
    if (items.some((it) => Number(it.quantity_delivered) < 0)) {
      setError('Quantité livrée invalide');
      return;
    }
    try {
      await onSubmit({
        store_id: storeId,
        delivery_date: date,
        order_reference: orderRef,
        notes,
        items: items.map((it) => ({
          product_id: it.product_id,
          quantity_delivered: Number(it.quantity_delivered) || 0,
          quantity_recovered: Number(it.quantity_recovered) || 0,
          unit_price_ht: it.unit_price_ht === '' ? null : Number(it.unit_price_ht),
          vat_rate:      it.vat_rate      === '' ? null : Number(it.vat_rate),
        })),
      });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Une erreur est survenue');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Enseigne *</label>
        <select
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={storeId}
          onChange={(e) => setStoreId(Number(e.target.value))}
          disabled={!!initial}
        >
          {stores.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Date de livraison *</label>
        <input
          type="date"
          lang="fr"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </div>

      {/* ── Lignes produits ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">Produits</label>
          <button
            type="button"
            onClick={addRow}
            className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100 transition"
          >
            + Ajouter un produit
          </button>
        </div>

        {items.map((it, idx) => (
          <div key={idx} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">Ligne {idx + 1}</span>
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Supprimer
                </button>
              )}
            </div>

            <select
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
              value={it.product_id ?? ''}
              onChange={(e) => handleProductChange(idx, e.target.value)}
            >
              <option value="">— Aucun produit —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            <div className={showReturns ? 'grid grid-cols-2 gap-2' : ''}>
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">Qté livrée</label>
                <input
                  type="number"
                  min={0}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
                  value={it.quantity_delivered}
                  onChange={(e) => updateItem(idx, { quantity_delivered: Number(e.target.value) })}
                  required
                />
              </div>
              {showReturns && (
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">Qté récupérée</label>
                  <input
                    type="number"
                    min={0}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
                    value={it.quantity_recovered}
                    onChange={(e) => updateItem(idx, { quantity_recovered: Number(e.target.value) })}
                  />
                </div>
              )}
            </div>

          </div>
        ))}
      </div>

      {/* ── Totaux ── */}
      <div className="bg-blue-50 rounded-lg p-3 text-sm space-y-1">
        <div>
          <span className="text-gray-600">Total : </span>
          <span className="font-bold text-blue-700 text-lg">{totalQty}</span>
          <span className="text-gray-600 ml-1">unités</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Réf. commande</label>
        <input
          type="text"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={orderRef}
          onChange={(e) => setOrderRef(e.target.value)}
          placeholder="N° de commande (optionnel)"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Remarques éventuelles…"
        />
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium"
        >
          {loading ? 'Enregistrement…' : initial ? 'Modifier' : 'Créer'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
