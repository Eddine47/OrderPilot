import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi, type ProductPayload } from '../api/products';
import type { Product } from '../types';

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ProductForm({
  initial,
  onSubmit,
  onCancel,
  loading,
}: {
  initial?: Product;
  onSubmit: (data: ProductPayload) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}) {
  const [name, setName]                   = useState(initial?.name ?? '');
  const [unit, setUnit]                   = useState(initial?.unit ?? 'unité');
  const [unitPriceHt, setUnitPriceHt]     = useState<string>(initial ? String(initial.unit_price_ht) : '0');
  const [vatRate, setVatRate]             = useState<string>(initial ? String(initial.vat_rate) : '20');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit({
      name: name.trim(),
      unit: unit.trim() || 'unité',
      unit_price_ht: Number(unitPriceHt) || 0,
      vat_rate: Number(vatRate) || 0,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Unité</label>
        <input
          type="text"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="unité, kg, paquet…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Prix unitaire HT (€)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={unitPriceHt}
            onChange={(e) => setUnitPriceHt(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">TVA (%)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={vatRate}
            onChange={(e) => setVatRate(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
        >
          {loading ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}

export default function Products() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate]       = useState(false);
  const [editProduct, setEditProduct]     = useState<Product | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn:  () => productsApi.list().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: productsApi.create,
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['products'] }); setShowCreate(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ProductPayload> }) =>
      productsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); setEditProduct(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: productsApi.delete,
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      setConfirmDeleteId(null);
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Mes produits</h1>
          <p className="text-gray-500 text-sm">Catalogue de produits livrés ou vendus</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium"
        >
          + Nouveau produit
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Chargement…</div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>Aucun produit</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => {
            const price = Number(p.unit_price_ht);
            const vat   = Number(p.vat_rate);
            const ttc   = price * (1 + vat / 100);
            return (
              <div key={p.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-800 truncate">{p.name}</div>
                    <div className="text-xs text-gray-500">Unité : {p.unit}</div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0 items-center">
                    {confirmDeleteId === p.id ? (
                      <>
                        <span className="text-xs text-red-600 font-medium">Supprimer ?</span>
                        <button
                          onClick={() => deleteMutation.mutate(p.id)}
                          disabled={deleteMutation.isPending}
                          className="text-xs bg-red-600 text-white px-2 py-0.5 rounded hover:bg-red-700 disabled:opacity-50"
                        >
                          Oui
                        </button>
                        <button onClick={() => setConfirmDeleteId(null)} className="text-xs text-gray-500 hover:text-gray-700 px-1">
                          Non
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => setEditProduct(p)} className="text-gray-400 hover:text-blue-600 p-1 rounded text-xs">
                          Modifier
                        </button>
                        <button onClick={() => setConfirmDeleteId(p.id)} className="text-gray-400 hover:text-red-600 p-1 rounded text-xs">
                          Suppr.
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-sm">
                  <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs">
                    {price.toFixed(2)} € HT
                  </span>
                  <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full text-xs">
                    TVA {vat.toFixed(2)}%
                  </span>
                  <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-full text-xs">
                    {ttc.toFixed(2)} € TTC
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <Modal title="Nouveau produit" onClose={() => setShowCreate(false)}>
          <ProductForm
            onSubmit={async (data) => { await createMutation.mutateAsync(data); }}
            onCancel={() => setShowCreate(false)}
            loading={createMutation.isPending}
          />
        </Modal>
      )}

      {editProduct && (
        <Modal title="Modifier le produit" onClose={() => setEditProduct(null)}>
          <ProductForm
            initial={editProduct}
            onSubmit={async (data) => { await updateMutation.mutateAsync({ id: editProduct.id, data }); }}
            onCancel={() => setEditProduct(null)}
            loading={updateMutation.isPending}
          />
        </Modal>
      )}
    </div>
  );
}
