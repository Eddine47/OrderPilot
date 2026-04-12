import { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useReactToPrint } from 'react-to-print';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { storesApi } from '../api/stores';
import { deliveriesApi } from '../api/deliveries';
import DeliveryForm from '../components/DeliveryForm';
import DeliverySlip from '../components/DeliverySlip';
import type { Delivery } from '../types';
import { MONTH_NAMES } from '../types';

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

export default function StoreDetail() {
  const { id } = useParams<{ id: string }>();
  const storeId = Number(id);
  const qc = useQueryClient();

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year,  setYear]  = useState(now.getFullYear());
  const [editDel,     setEditDel]     = useState<Delivery | null>(null);
  const [showAddDel,  setShowAddDel]  = useState(false);
  const [showSlip,    setShowSlip]    = useState(false);

  const slipRef    = useRef<HTMLDivElement>(null);
  const [pendingPrint, setPendingPrint] = useState(false);

  const { data: store, isLoading: storeLoading } = useQuery({
    queryKey: ['store', storeId],
    queryFn:  () => storesApi.get(storeId).then((r) => r.data),
  });

  const { data: deliveries = [], isLoading: delLoading } = useQuery({
    queryKey: ['deliveries', { store_id: storeId, month, year }],
    queryFn:  () => deliveriesApi.list({ store_id: storeId, month, year }).then((r) => r.data),
  });

  const { data: slip } = useQuery({
    queryKey: ['slip', storeId, month, year],
    queryFn:  () => storesApi.slip(storeId, month, year).then((r) => r.data),
    enabled:  showSlip,
  });

  const { data: allStores = [] } = useQuery({
    queryKey: ['stores'],
    queryFn:  () => storesApi.list().then((r) => r.data),
  });

  const updateMutation = useMutation({
    mutationFn: ({ delId, data }: { delId: number; data: Parameters<typeof deliveriesApi.update>[1] }) =>
      deliveriesApi.update(delId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deliveries', { store_id: storeId, month, year }] });
      qc.invalidateQueries({ queryKey: ['slip', storeId, month, year] });
      setEditDel(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deliveriesApi.delete,
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['deliveries', { store_id: storeId, month, year }] });
      qc.invalidateQueries({ queryKey: ['slip', storeId, month, year] });
    },
  });

  const createMutation = useMutation({
    mutationFn: deliveriesApi.create,
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['deliveries', { store_id: storeId, month, year }] });
      qc.invalidateQueries({ queryKey: ['slip', storeId, month, year] });
      setShowAddDel(false);
    },
  });

  const handlePrint = useReactToPrint({
    content:      () => slipRef.current,
    documentTitle: `BL-${store?.name ?? ''}-${MONTH_NAMES[month - 1]}-${year}`,
    copyStyles:   false,
    pageStyle: `
      @page { margin: 10mm; }
      body  { margin: 0; }
    `,
  });

  // Ref stable pour éviter la stale closure dans useEffect
  const printFnRef = useRef<(() => void) | null>(null);
  useEffect(() => { printFnRef.current = handlePrint; });

  useEffect(() => {
    if (pendingPrint && slip && slipRef.current) {
      printFnRef.current?.();
      setPendingPrint(false);
    }
  }, [pendingPrint, slip]); // eslint-disable-line react-hooks/exhaustive-deps

  const monthTotal = deliveries.reduce((s, d) => s + d.total_quantity, 0);

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  if (storeLoading) return <div className="text-center py-12 text-gray-400">Chargement…</div>;
  if (!store) return <div className="text-center py-12 text-red-500">Enseigne introuvable</div>;

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/enseignes" className="hover:text-blue-600">Enseignes</Link>
        <span>›</span>
        <span className="text-gray-800 font-medium">{store.name}</span>
      </div>

      {/* Store header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">{store.name}</h1>
            {store.address && <p className="text-sm text-gray-500">{store.address}</p>}
            {store.contact_name && (
              <p className="text-sm text-gray-500">
                {store.contact_name} {store.contact_phone && `— ${store.contact_phone}`}
              </p>
            )}
          </div>
          <button
            onClick={() => setShowAddDel(true)}
            className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium"
          >
            + Livraison
          </button>
        </div>
      </div>

      {/* Month selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
        >
          {MONTH_NAMES.map((name, i) => (
            <option key={i + 1} value={i + 1}>{name}</option>
          ))}
        </select>
        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        >
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">
            Total : <strong className="text-blue-700 text-base">{monthTotal}</strong>
          </span>
          <button
            onClick={() => { setShowSlip(true); setPendingPrint(true); }}
            className="text-sm bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 transition"
          >
            Imprimer le bon
          </button>
        </div>
      </div>

      {/* Deliveries table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">N°</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Livré</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Récupéré</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Total</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Statut</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {delLoading ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">Chargement…</td></tr>
            ) : deliveries.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">Aucune livraison ce mois</td></tr>
            ) : deliveries.map((d) => (
              <tr key={d.id} className={
                d.is_recurring && d.status !== 'ok' ? 'bg-purple-100' :
                d.status === 'ok' ? 'bg-green-50' : ''
              }>
                <td className="px-4 py-3 text-gray-500">
                  {d.delivery_number}
                  {d.is_recurring && (
                    <span className="ml-1 text-xs bg-purple-100 text-purple-600 rounded px-1">R</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {format(new Date(d.delivery_date.slice(0, 10) + 'T12:00:00'), 'dd/MM/yy', { locale: fr })}
                </td>
                <td className="px-4 py-3 text-right">{d.quantity_delivered}</td>
                <td className="px-4 py-3 text-right text-orange-600">
                  {d.quantity_recovered > 0 ? d.quantity_recovered : '—'}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-blue-700">{d.total_quantity}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                    d.status === 'ok' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {d.status === 'ok' ? 'OK' : 'En attente'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 justify-end">
                    <button
                      onClick={() => setEditDel(d)}
                      className="text-gray-400 hover:text-blue-600 p-1 text-xs transition"
                      title="Modifier"
                    >Modifier</button>
                    <button
                      onClick={() => window.confirm('Supprimer ?') && deleteMutation.mutate(d.id)}
                      className="text-gray-400 hover:text-red-600 p-1 text-xs transition"
                      title="Supprimer"
                    >Suppr.</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {deliveries.length > 0 && (
            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
              <tr>
                <td colSpan={4} className="px-4 py-3 font-semibold text-right text-gray-700">TOTAL DU MOIS</td>
                <td className="px-4 py-3 text-right font-bold text-blue-700 text-base">{monthTotal}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Zone d'impression — hors écran mais accessible à react-to-print */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        {slip && <DeliverySlip ref={slipRef} slip={slip} />}
      </div>

      {/* Modal: edit delivery */}
      {editDel && (
        <Modal title="Modifier la livraison" onClose={() => setEditDel(null)}>
          <DeliveryForm
            stores={allStores}
            initial={editDel}
            onSubmit={async (data) => { await updateMutation.mutateAsync({ delId: editDel.id, data }); }}
            onCancel={() => setEditDel(null)}
            loading={updateMutation.isPending}
          />
        </Modal>
      )}

      {/* Modal: add delivery */}
      {showAddDel && (
        <Modal title="Nouvelle livraison" onClose={() => setShowAddDel(false)}>
          <DeliveryForm
            stores={allStores.filter((s) => s.id === storeId)}
            onSubmit={async (data) => { await createMutation.mutateAsync(data); }}
            onCancel={() => setShowAddDel(false)}
            loading={createMutation.isPending}
          />
        </Modal>
      )}
    </div>
  );
}
