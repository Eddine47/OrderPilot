import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { productsApi } from '../api/products';
import type { Delivery, Store } from '../types';

interface SubmitData {
  store_id: number;
  delivery_date: string;
  quantity_delivered: number;
  quantity_recovered: number;
  order_reference: string;
  notes: string;
  product_id: number | null;
  unit_price_ht: number | null;
  vat_rate: number | null;
}

interface Props {
  stores: Store[];
  initial?: Partial<Delivery>;
  onSubmit: (data: SubmitData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export default function DeliveryForm({ stores, initial, onSubmit, onCancel, loading }: Props) {
  const today = new Date().toISOString().slice(0, 10);

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn:  () => productsApi.list().then((r) => r.data),
  });

  const [storeId,    setStoreId]    = useState(initial?.store_id ?? (stores[0]?.id || 0));
  const selectedStore = stores.find((s) => s.id === storeId);
  const showReturns   = selectedStore?.has_returns ?? false;

  const [date,       setDate]       = useState((initial?.delivery_date ?? today).slice(0, 10));
  const [qty,        setQty]        = useState(initial?.quantity_delivered ?? 0);
  const [recovered,  setRecovered]  = useState(initial?.quantity_recovered ?? 0);
  const [orderRef,   setOrderRef]   = useState(initial?.order_reference ?? '');
  const [notes,      setNotes]      = useState(initial?.notes ?? '');
  const [productId,  setProductId]  = useState<number | ''>(initial?.product_id ?? '');
  const [unitPrice,  setUnitPrice]  = useState<string>(initial?.unit_price_ht != null ? String(initial.unit_price_ht) : '');
  const [vatRate,    setVatRate]    = useState<string>(initial?.vat_rate != null ? String(initial.vat_rate) : '');
  const [error,      setError]      = useState('');

  useEffect(() => {
    if (!initial && stores.length > 0) setStoreId(stores[0].id);
  }, [stores, initial]);

  // Auto-fill price and VAT when the user selects a product (only if not set yet)
  function handleProductChange(value: string) {
    if (value === '') {
      setProductId('');
      return;
    }
    const pid = Number(value);
    setProductId(pid);
    const p = products.find((x) => x.id === pid);
    if (p) {
      setUnitPrice(String(p.unit_price_ht));
      setVatRate(String(p.vat_rate));
    }
  }

  const total       = showReturns ? qty - recovered : qty;
  const priceNum    = Number(unitPrice) || 0;
  const vatNum      = Number(vatRate)   || 0;
  const totalHt     = total * priceNum;
  const totalTtc    = totalHt * (1 + vatNum / 100);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!storeId) { setError('Sélectionnez une enseigne'); return; }
    if (qty < 0)  { setError('Quantité livrée invalide'); return; }
    try {
      await onSubmit({
        store_id: storeId,
        delivery_date: date,
        quantity_delivered: qty,
        quantity_recovered: recovered,
        order_reference: orderRef,
        notes,
        product_id: productId === '' ? null : Number(productId),
        unit_price_ht: unitPrice === '' ? null : Number(unitPrice),
        vat_rate: vatRate === ''       ? null : Number(vatRate),
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

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Produit</label>
        <select
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={productId === '' ? '' : String(productId)}
          onChange={(e) => handleProductChange(e.target.value)}
        >
          <option value="">— Aucun —</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className={showReturns ? 'grid grid-cols-2 gap-4' : ''}>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Qté livrée *</label>
          <input
            type="number"
            min={0}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            required
          />
        </div>
        {showReturns && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Qté récupérée</label>
            <input
              type="number"
              min={0}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={recovered}
              onChange={(e) => setRecovered(Number(e.target.value))}
            />
          </div>
        )}
      </div>

      <div className="bg-blue-50 rounded-lg p-3 text-sm space-y-1">
        <div>
          <span className="text-gray-600">Total : </span>
          <span className="font-bold text-blue-700 text-lg">{total}</span>
          <span className="text-gray-600 ml-1">unités</span>
        </div>
        {priceNum > 0 && (
          <div className="flex justify-between text-xs text-gray-600">
            <span>Total HT : <span className="font-semibold text-gray-800">{totalHt.toFixed(2)} €</span></span>
            <span>Total TTC : <span className="font-semibold text-green-700">{totalTtc.toFixed(2)} €</span></span>
          </div>
        )}
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
