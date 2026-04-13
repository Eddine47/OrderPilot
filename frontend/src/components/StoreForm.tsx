import { useState } from 'react';
import type { Store } from '../types';

interface Props {
  initial?: Partial<Store>;
  onSubmit: (data: { name: string; address: string; contact_name: string; contact_phone: string; has_returns: boolean }) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export default function StoreForm({ initial, onSubmit, onCancel, loading }: Props) {
  const [name,       setName]       = useState(initial?.name         ?? '');
  const [address,    setAddress]    = useState(initial?.address       ?? '');
  const [contact,    setContact]    = useState(initial?.contact_name  ?? '');
  const [phone,      setPhone]      = useState(initial?.contact_phone ?? '');
  const [hasReturns, setHasReturns] = useState(initial?.has_returns   ?? false);
  const [error,      setError]      = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Le nom est requis'); return; }
    try {
      await onSubmit({ name, address, contact_name: contact, contact_phone: phone, has_returns: hasReturns });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Une erreur est survenue');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'enseigne *</label>
        <input
          type="text"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex : Intermarché, Leclerc…"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
        <textarea
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={2}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Adresse de livraison…"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
          <input
            type="text"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="Nom du contact"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
          <input
            type="tel"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="06 00 00 00 00"
          />
        </div>
      </div>

      <div>
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div
            onClick={() => setHasReturns(!hasReturns)}
            className={`relative w-10 h-5 rounded-full transition-colors ${hasReturns ? 'bg-blue-600' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${hasReturns ? 'translate-x-5' : ''}`} />
          </div>
          <span className="text-sm font-medium text-gray-700">Produits retournés</span>
        </label>
        <p className="text-xs text-gray-500 mt-1 ml-13">
          {hasReturns
            ? 'Cette enseigne pratique les retours — le champ "quantité récupérée" sera visible.'
            : 'Aucun retour pour cette enseigne.'}
        </p>
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
