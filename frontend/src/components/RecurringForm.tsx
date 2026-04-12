import { useState } from 'react';
import type { Store } from '../types';

interface Props {
  stores: Store[];
  onSubmit: (data: { store_id: number; day_of_month: number; quantity: number }) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export default function RecurringForm({ stores, onSubmit, onCancel, loading }: Props) {
  const [storeId, setStoreId] = useState(stores[0]?.id || 0);
  const [days,    setDays]    = useState<number[]>([]);
  const [qty,     setQty]     = useState(10);
  const [error,   setError]   = useState('');

  function toggleDay(d: number) {
    setDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!storeId)       { setError('Sélectionnez une enseigne'); return; }
    if (days.length === 0) { setError('Sélectionnez au moins un jour'); return; }
    if (qty < 1)        { setError('Quantité invalide'); return; }
    try {
      for (const day of days) {
        await onSubmit({ store_id: storeId, day_of_month: day, quantity: qty });
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Une erreur est survenue');
    }
  }

  // Grille 1-31 : 7 colonnes
  const allDays = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Enseigne *</label>
        <select
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={storeId}
          onChange={(e) => setStoreId(Number(e.target.value))}
        >
          {stores.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Jours du mois *
          {days.length > 0 && (
            <span className="ml-2 text-blue-600 font-normal">
              ({days.join(', ')})
            </span>
          )}
        </label>
        <div className="grid grid-cols-7 gap-1">
          {allDays.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => toggleDay(d)}
              className={`aspect-square rounded-md text-sm font-medium transition border ${
                days.includes(d)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400 hover:bg-blue-50'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Les jours inexistants dans un mois court (ex: 31 en avril) sont ignorés automatiquement.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Quantité par livraison *</label>
        <input
          type="number"
          min={1}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
          required
        />
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading || days.length === 0}
          className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium"
        >
          {loading ? 'Enregistrement…' : `Créer ${days.length} règle(s)`}
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
