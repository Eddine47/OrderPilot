import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { storesApi } from '../api/stores';
import { recurringApi } from '../api/recurring';
import StoreForm from '../components/StoreForm';
import RecurringForm from '../components/RecurringForm';
import type { Store, RecurringRule } from '../types';

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

export default function StoreList() {
  const qc = useQueryClient();
  const [search,          setSearch]          = useState('');
  const [showCreate,      setShowCreate]      = useState(false);
  const [editStore,       setEditStore]       = useState<Store | null>(null);
  const [showRecurring,   setShowRecurring]   = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const { data: stores = [], isLoading } = useQuery({
    queryKey: ['stores', search],
    queryFn:  () => storesApi.list(search || undefined).then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: storesApi.create,
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['stores'] }); setShowCreate(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof storesApi.update>[1] }) =>
      storesApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['stores'] }); setEditStore(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: storesApi.delete,
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['stores'] });
      setConfirmDeleteId(null);
    },
  });

  const recurMutation = useMutation({
    mutationFn: recurringApi.create,
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['recurring'] }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Enseignes</h1>
          <p className="text-gray-500 text-sm">Gérez vos clients et règles récurrentes</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowRecurring(true)}
            className="text-sm bg-purple-100 text-purple-700 px-3 py-2 rounded-lg hover:bg-purple-200 transition"
          >
            Récurrentes
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium"
          >
            + Nouvelle enseigne
          </button>
        </div>
      </div>

      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="Rechercher une enseigne…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Chargement…</div>
      ) : stores.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>Aucune enseigne trouvée</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stores.map((store) => (
            <div key={store.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    to={`/enseignes/${store.id}`}
                    className="font-semibold text-gray-800 hover:text-blue-700 truncate block"
                  >
                    {store.name}
                  </Link>
                  {store.address && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{store.address}</p>
                  )}
                  {store.contact_name && (
                    <p className="text-xs text-gray-500">Contact : {store.contact_name}</p>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0 items-center">
                  {confirmDeleteId === store.id ? (
                    <>
                      <span className="text-xs text-red-600 font-medium">Supprimer ?</span>
                      <button
                        onClick={() => deleteMutation.mutate(store.id)}
                        disabled={deleteMutation.isPending}
                        className="text-xs bg-red-600 text-white px-2 py-0.5 rounded transition hover:bg-red-700 disabled:opacity-50"
                      >
                        Oui
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-xs text-gray-500 hover:text-gray-700 px-1 transition"
                      >
                        Non
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setEditStore(store)}
                        className="text-gray-400 hover:text-blue-600 p-1 rounded text-xs transition"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(store.id)}
                        className="text-gray-400 hover:text-red-600 p-1 rounded text-xs transition"
                      >
                        Suppr.
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs">
                  {store.delivery_count ?? 0} livraisons
                </span>
                <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-full text-xs">
                  Total : {store.total_quantity ?? 0}
                </span>
                {store.has_returns && (
                  <span className="bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full text-xs">
                    Retours
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: create store */}
      {showCreate && (
        <Modal title="Nouvelle enseigne" onClose={() => setShowCreate(false)}>
          <StoreForm
            onSubmit={async (data) => { await createMutation.mutateAsync(data); }}
            onCancel={() => setShowCreate(false)}
            loading={createMutation.isPending}
          />
        </Modal>
      )}

      {/* Modal: edit store */}
      {editStore && (
        <Modal title="Modifier l'enseigne" onClose={() => setEditStore(null)}>
          <StoreForm
            initial={editStore}
            onSubmit={async (data) => { await updateMutation.mutateAsync({ id: editStore.id, data }); }}
            onCancel={() => setEditStore(null)}
            loading={updateMutation.isPending}
          />
        </Modal>
      )}

      {/* Modal: recurring rules */}
      {showRecurring && (
        <Modal title="Livraisons récurrentes" onClose={() => setShowRecurring(false)}>
          <RecurringForm
            stores={stores}
            onSubmit={async (data) => { await recurMutation.mutateAsync(data); }}
            onCancel={() => setShowRecurring(false)}
            loading={recurMutation.isPending}
          />
          <RecurringRulesList />
        </Modal>
      )}
    </div>
  );
}

function RecurringRulesList() {
  const qc = useQueryClient();
  const { data: rules = [] } = useQuery({
    queryKey: ['recurring'],
    queryFn:  () => recurringApi.list().then((r) => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: recurringApi.delete,
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['recurring'] });
      qc.invalidateQueries({ queryKey: ['recurring-rules'] });
    },
  });

  async function deleteAllForStore(storeRules: RecurringRule[]) {
    if (!window.confirm(`Supprimer toutes les règles récurrentes de "${storeRules[0].store_name}" ?`)) return;
    await Promise.all(storeRules.map((r) => recurringApi.delete(r.id)));
    qc.invalidateQueries({ queryKey: ['recurring'] });
    qc.invalidateQueries({ queryKey: ['recurring-rules'] });
  }

  if (rules.length === 0) return null;

  // Grouper par enseigne
  const byStore = rules.reduce<Record<string, RecurringRule[]>>((acc, r) => {
    if (!acc[r.store_name]) acc[r.store_name] = [];
    acc[r.store_name].push(r);
    return acc;
  }, {});

  return (
    <div className="mt-4 border-t pt-4 space-y-2">
      <h3 className="text-sm font-semibold text-gray-700">Règles existantes</h3>
      {Object.entries(byStore).map(([storeName, storeRules]) => (
        <div key={storeName} className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-sm">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div>
              <span className="font-medium text-purple-900">{storeName}</span>
              <span className="ml-2 text-xs text-purple-600">{storeRules[0].quantity} unités/j</span>
            </div>
            <button
              onClick={() => deleteAllForStore(storeRules)}
              className="text-xs text-red-500 hover:text-red-700 hover:underline whitespace-nowrap transition"
              title="Supprimer toutes les règles de cette enseigne"
            >
              Tout supprimer
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {storeRules
              .slice()
              .sort((a, b) => a.day_of_month - b.day_of_month)
              .map((r) => (
                <span
                  key={r.id}
                  className="inline-flex items-center gap-1 bg-white border border-purple-200 text-purple-700 rounded px-1.5 py-0.5 text-xs"
                >
                  {r.day_of_month}
                  <button
                    onClick={() => deleteMutation.mutate(r.id)}
                    className="text-purple-400 hover:text-red-500 font-bold leading-none"
                  >
                    ×
                  </button>
                </span>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
