import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { deliveriesApi } from '../api/deliveries';
import { storesApi } from '../api/stores';
import DeliveryForm from '../components/DeliveryForm';
import type { Delivery } from '../types';
import { MONTH_NAMES } from '../types';

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function DeliveryList() {
  const qc  = useQueryClient();
  const now = new Date();

  const [storeFilter,  setStoreFilter]  = useState('');
  const [dateFilter,   setDateFilter]   = useState('');
  const [monthFilter,  setMonthFilter]  = useState<number | ''>('');
  const [yearFilter,   setYearFilter]   = useState(now.getFullYear());
  const [statusFilter, setStatusFilter] = useState<'' | 'pending' | 'ok'>('');
  const [showCreate,   setShowCreate]   = useState(false);
  const [editDel,      setEditDel]      = useState<Delivery | null>(null);

  const filters = {
    store_id: storeFilter ? Number(storeFilter) : undefined,
    date:     dateFilter  || undefined,
    month:    monthFilter || undefined,
    year:     yearFilter  || undefined,
    status:   (statusFilter || undefined) as 'pending' | 'ok' | undefined,
  };

  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ['deliveries', filters],
    queryFn:  () => deliveriesApi.list(filters).then((r) => r.data),
  });

  const { data: stores = [] } = useQuery({
    queryKey: ['stores'],
    queryFn:  () => storesApi.list().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: deliveriesApi.create,
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['deliveries'] }); setShowCreate(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof deliveriesApi.update>[1] }) =>
      deliveriesApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['deliveries'] }); setEditDel(null); },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'pending' | 'ok' }) =>
      deliveriesApi.patchStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deliveries'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: deliveriesApi.delete,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['deliveries'] }),
  });

  const totalQty = deliveries.reduce((s, d) => s + d.total_quantity, 0);

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Livraisons</h1>
          <p className="text-gray-500 text-sm">Historique et gestion des livraisons</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium"
        >
          + Nouvelle livraison
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={storeFilter}
          onChange={(e) => setStoreFilter(e.target.value)}
        >
          <option value="">Toutes les enseignes</option>
          {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <input
          type="date"
          lang="fr"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={dateFilter}
          onChange={(e) => { setDateFilter(e.target.value); setMonthFilter(''); }}
          placeholder="Date précise"
        />

        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={monthFilter}
          onChange={(e) => { setMonthFilter(e.target.value ? Number(e.target.value) : ''); setDateFilter(''); }}
        >
          <option value="">Tous les mois</option>
          {MONTH_NAMES.map((name, i) => <option key={i + 1} value={i + 1}>{name}</option>)}
        </select>

        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={yearFilter}
          onChange={(e) => setYearFilter(Number(e.target.value))}
        >
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>

        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as '' | 'pending' | 'ok')}
        >
          <option value="">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="ok">OK</option>
        </select>
      </div>

      {/* Summary */}
      {deliveries.length > 0 && (
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>{deliveries.length} livraison{deliveries.length > 1 ? 's' : ''}</span>
          <span className="font-semibold text-blue-700">Total : {totalQty}</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">N°</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Enseigne</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Livré</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Récupéré</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Total</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Statut</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={8} className="text-center py-10 text-gray-400">Chargement…</td></tr>
            ) : deliveries.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-10 text-gray-400">Aucune livraison trouvée</td></tr>
            ) : deliveries.map((d) => (
              <tr key={d.id} className={
                d.is_recurring && d.status !== 'ok' ? 'bg-purple-100' :
                d.status === 'ok' ? 'bg-green-50' : ''
              }>
                <td className="px-4 py-3 text-gray-500">{d.delivery_number}</td>
                <td className="px-4 py-3">
                  {format(new Date(d.delivery_date.slice(0, 10) + 'T12:00:00'), 'dd/MM/yyyy', { locale: fr })}
                </td>
                <td className="px-4 py-3 font-medium">{d.store_name}</td>
                <td className="px-4 py-3 text-right">{d.quantity_delivered}</td>
                <td className="px-4 py-3 text-right text-orange-600">
                  {d.quantity_recovered > 0 ? d.quantity_recovered : '—'}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-blue-700">{d.total_quantity}</td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => statusMutation.mutate({ id: d.id, status: d.status === 'ok' ? 'pending' : 'ok' })}
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium transition ${
                      d.status === 'ok'
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {d.status === 'ok' ? 'OK' : 'En attente'}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 justify-end">
                    <button
                      onClick={() => setEditDel(d)}
                      className="text-gray-400 hover:text-blue-600 p-1 text-xs transition"
                    >Modifier</button>
                    <button
                      onClick={() => window.confirm('Supprimer ?') && deleteMutation.mutate(d.id)}
                      className="text-gray-400 hover:text-red-600 p-1 text-xs transition"
                    >Suppr.</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <Modal title="Nouvelle livraison" onClose={() => setShowCreate(false)}>
          <DeliveryForm
            stores={stores}
            onSubmit={async (data) => { await createMutation.mutateAsync(data); }}
            onCancel={() => setShowCreate(false)}
            loading={createMutation.isPending}
          />
        </Modal>
      )}

      {editDel && (
        <Modal title="Modifier la livraison" onClose={() => setEditDel(null)}>
          <DeliveryForm
            stores={stores}
            initial={editDel}
            onSubmit={async (data) => { await updateMutation.mutateAsync({ id: editDel.id, data }); }}
            onCancel={() => setEditDel(null)}
            loading={updateMutation.isPending}
          />
        </Modal>
      )}
    </div>
  );
}
