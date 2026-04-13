import { useState, useEffect } from 'react';
import type { Delivery, Store } from '../types';

interface Props {
  stores: Store[];
  initial?: Partial<Delivery>;
  onSubmit: (data: {
    store_id: number;
    delivery_date: string;
    quantity_delivered: number;
    quantity_recovered: number;
    order_reference: string;
    notes: string;
  }) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export default function DeliveryForm({ stores, initial, onSubmit, onCancel, loading }: Props) {
  const today = new Date().toISOString().slice(0, 10);

  // .slice(0,10) garantit le format YYYY-MM-DD même si le backend renvoie un timestamp avec timezone
  const [storeId,    setStoreId]    = useState(initial?.store_id ?? (stores[0]?.id || 0));
  const [date,       setDate]       = useState((initial?.delivery_date ?? today).slice(0, 10));
  const [qty,        setQty]        = useState(initial?.quantity_delivered ?? 0);
  const [recovered,  setRecovered]  = useState(initial?.quantity_recovered ?? 0);
  const [orderRef,   setOrderRef]   = useState(initial?.order_reference ?? '');
  const [notes,      setNotes]      = useState(initial?.notes ?? '');
  const [error,      setError]      = useState('');

  useEffect(() => {
    if (!initial && stores.length > 0) setStoreId(stores[0].id);
  }, [stores, initial]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!storeId) { setError('Sélectionnez une enseigne'); return; }
    if (qty < 0)  { setError('Quantité livrée invalide'); return; }
    try {
      await onSubmit({ store_id: storeId, delivery_date: date, quantity_delivered: qty, quantity_recovered: recovered, order_reference: orderRef, notes });
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

      <div className={initial ? 'grid grid-cols-2 gap-4' : ''}>
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
        {initial && (
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

      <div className="bg-blue-50 rounded-lg p-3 text-sm">
        <span className="text-gray-600">Total : </span>
        <span className="font-bold text-blue-700 text-lg">{qty - recovered}</span>
        <span className="text-gray-600 ml-1">unités</span>
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
