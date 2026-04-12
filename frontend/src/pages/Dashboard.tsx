import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useReactToPrint } from 'react-to-print';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { deliveriesApi } from '../api/deliveries';
import { storesApi } from '../api/stores';
import { recurringApi } from '../api/recurring';
import { useAuth } from '../contexts/AuthContext';
import DeliveryForm from '../components/DeliveryForm';
import type { Delivery, RecurringRule } from '../types';
import { MONTH_NAMES } from '../types';

export default function Dashboard() {
  const qc      = useQueryClient();
  const { user } = useAuth();
  const today   = new Date();

  const [showForm,  setShowForm]  = useState(false);
  const [editDel,   setEditDel]   = useState<Delivery | null>(null);
  const [creating,  setCreating]  = useState(false);
  // IDs de règles récurrentes ignorées pour aujourd'hui (état local)
  const [dismissed, setDismissed] = useState<number[]>([]);

  const printRef = useRef<HTMLDivElement>(null);

  const { data: todayDeliveries = [], isLoading } = useQuery({
    queryKey: ['deliveries', 'today'],
    queryFn:  () => deliveriesApi.today().then((r) => r.data),
  });

  const { data: monthTotal } = useQuery({
    queryKey: ['monthly-total', today.getMonth() + 1, today.getFullYear()],
    queryFn:  () => deliveriesApi.monthlyTotal(today.getMonth() + 1, today.getFullYear()).then((r) => r.data),
  });

  const { data: stores = [] } = useQuery({
    queryKey: ['stores'],
    queryFn:  () => storesApi.list().then((r) => r.data),
  });

  const { data: recurringRules = [] } = useQuery({
    queryKey: ['recurring-rules'],
    queryFn:  () => recurringApi.list().then((r) => r.data),
  });

  // Règles récurrentes qui correspondent à aujourd'hui et sans livraison existante
  const todayDay = today.getDate();
  const pendingRecurring: RecurringRule[] = recurringRules.filter(
    (r) =>
      r.is_active &&
      r.day_of_month === todayDay &&
      !dismissed.includes(r.id) &&
      !todayDeliveries.some((d) => d.store_id === r.store_id),
  );

  const handlePrint = useReactToPrint({
    content:      () => printRef.current,
    documentTitle: `Bon-journalier-${today.toISOString().slice(0, 10)}`,
    copyStyles:   false,
    pageStyle: `
      @page { margin: 10mm; }
      body  { margin: 0; }
    `,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'pending' | 'ok' }) =>
      deliveriesApi.patchStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deliveries', 'today'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: deliveriesApi.delete,
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['deliveries', 'today'] });
      qc.invalidateQueries({ queryKey: ['monthly-total'] });
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof deliveriesApi.create>[0]) =>
      deliveriesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deliveries', 'today'] });
      qc.invalidateQueries({ queryKey: ['monthly-total'] });
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof deliveriesApi.update>[1] }) =>
      deliveriesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deliveries', 'today'] });
      qc.invalidateQueries({ queryKey: ['monthly-total'] });
      setEditDel(null);
    },
  });

  // Confirmer une livraison récurrente → crée la livraison en base
  function confirmRecurring(rule: RecurringRule) {
    createMutation.mutate({
      store_id:           rule.store_id,
      delivery_date:      today.toISOString().slice(0, 10),
      quantity_delivered: rule.quantity,
    });
  }

  function toggleStatus(d: Delivery) {
    statusMutation.mutate({ id: d.id, status: d.status === 'ok' ? 'pending' : 'ok' });
  }

  const pending  = todayDeliveries.filter((d) => d.status === 'pending');
  const done     = todayDeliveries.filter((d) => d.status === 'ok');
  const dayTotal = todayDeliveries.reduce((s, d) => s + d.total_quantity, 0);

  const todayLabel = format(today, 'EEEE d MMMM yyyy', { locale: fr })
    .replace(/^\w/, (c) => c.toUpperCase());

  const canPrint = todayDeliveries.length > 0;

  return (
    <div className="space-y-6">

      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">{todayLabel}</h1>
          <p className="text-gray-500 text-sm">Tableau de bord</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={canPrint ? handlePrint : undefined}
            disabled={!canPrint}
            className="text-sm bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            Imprimer le bon du jour
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium"
          >
            + Nouvelle livraison
          </button>
        </div>
      </div>

      {/* Résumé du mois */}
      {monthTotal && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label={`Total ${MONTH_NAMES[today.getMonth()]}`} value={monthTotal.total_quantity} color="blue" />
          <StatCard label="Livrées ce mois"    value={monthTotal.qty_delivered} color="green" />
          <StatCard label="Récupérées ce mois" value={monthTotal.qty_recovered} color="orange" />
          <StatCard label="Livraisons ce mois" value={monthTotal.deliveries}    color="purple" />
        </div>
      )}

      {/* Récurrentes en attente de confirmation */}
      {pendingRecurring.length > 0 && (
        <div className="bg-purple-50 rounded-xl border border-purple-200 p-4">
          <h2 className="font-semibold text-purple-800 mb-3 text-sm uppercase tracking-wide">
            Livraisons récurrentes prévues aujourd'hui
          </h2>
          <div className="space-y-2">
            {pendingRecurring.map((rule) => (
              <div key={rule.id} className="flex items-center gap-3 bg-white rounded-lg border border-purple-200 px-3 py-2">
                <div className="flex-1">
                  <span className="font-medium text-sm text-gray-800">{rule.store_name}</span>
                  <span className="ml-2 text-xs text-purple-600 bg-purple-100 rounded px-1">R</span>
                  <span className="ml-2 text-xs text-gray-500">{rule.quantity} paquets prévus</span>
                </div>
                <button
                  onClick={() => confirmRecurring(rule)}
                  disabled={createMutation.isPending}
                  className="text-xs bg-purple-600 text-white px-3 py-1 rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
                >
                  Confirmer
                </button>
                <button
                  onClick={() => setDismissed((prev) => [...prev, rule.id])}
                  className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 transition"
                >
                  Ignorer
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Liste du jour */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800">Livraisons aujourd'hui</h2>
          <span className="text-sm text-gray-500">
            {done.length} / {todayDeliveries.length} validées
            {dayTotal > 0 && (
              <span className="ml-2 font-semibold text-blue-700">· Total : {dayTotal}</span>
            )}
          </span>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-gray-400">Chargement…</div>
        ) : todayDeliveries.length === 0 ? (
          <div className="text-center py-8 text-gray-400">Aucune livraison aujourd'hui</div>
        ) : (
          <div className="space-y-2">
            {pending.map((d) => (
              <DeliveryRow key={d.id} delivery={d} onToggle={toggleStatus} onEdit={setEditDel}
                onDelete={(id) => window.confirm('Supprimer cette livraison ?') && deleteMutation.mutate(id)} />
            ))}
            {done.length > 0 && pending.length > 0 && (
              <div className="border-t border-dashed border-gray-200 my-2 pt-2">
                <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Validées</p>
              </div>
            )}
            {done.map((d) => (
              <DeliveryRow key={d.id} delivery={d} onToggle={toggleStatus} onEdit={setEditDel}
                onDelete={(id) => window.confirm('Supprimer cette livraison ?') && deleteMutation.mutate(id)} />
            ))}
          </div>
        )}
      </div>

      {/* Zone d'impression — inline styles obligatoires (Tailwind non chargé dans l'iframe react-to-print) */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <div ref={printRef} style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 11, color: '#000', background: '#fff' }}>
          {todayDeliveries.flatMap((d, idx) =>
            [1, 2].map((copy) => {
              const isLastPage = idx === todayDeliveries.length - 1 && copy === 2;
              const GREEN = '#1a6b3c';
              const cell = (extra?: React.CSSProperties): React.CSSProperties => ({
                border: '1px solid #bbb', padding: '4px 8px', fontSize: 11, ...extra,
              });
              return (
                <div key={`${d.id}-c${copy}`} style={{
                  pageBreakAfter: isLastPage ? 'avoid' : 'always',
                  breakAfter:     isLastPage ? 'avoid' : 'page',
                  padding: '16mm 14mm',
                  background: '#fff',
                  color: '#000',
                  boxSizing: 'border-box',
                  width: '100%',
                }}>

                  {/* ── EN-TÊTE ── */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    {/* Gauche */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                        <span style={{ fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase', color: '#555', border: '1px solid #bbb', padding: '2px 6px' }}>DATE</span>
                        <span style={{ fontSize: 13, fontWeight: 'bold' }}>{todayLabel}</span>
                      </div>
                      <div style={{ fontSize: 8, fontWeight: 'bold', textTransform: 'uppercase', color: '#555', marginBottom: 3 }}>EXPÉDITEUR</div>
                      <div style={{ border: '1px solid #bbb', padding: '6px 8px', minHeight: 56 }}>
                        <div style={{ fontWeight: 'bold', fontSize: 12 }}>{user?.company_name}</div>
                        {user?.company_address && <div style={{ fontSize: 10, marginTop: 2, whiteSpace: 'pre-line' }}>{user.company_address}</div>}
                        {user?.company_siret   && <div style={{ fontSize: 10, marginTop: 2 }}>Siret : {user.company_siret}</div>}
                      </div>
                    </div>

                    {/* Droite */}
                    <div style={{ flex: 1, paddingLeft: 16, textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0, marginBottom: 6 }}>
                        <div style={{ background: GREEN, color: '#fff', fontWeight: 'bold', fontSize: 11, padding: '4px 10px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          LIVRAISON N°
                        </div>
                        <div style={{ border: `2px solid ${GREEN}`, fontSize: 18, fontWeight: 'bold', padding: '2px 14px', minWidth: 44, textAlign: 'center', color: GREEN }}>
                          {d.delivery_number}
                        </div>
                      </div>
                      <div style={{ fontSize: 8, fontWeight: 'bold', textTransform: 'uppercase', color: '#555', marginBottom: 3 }}>DESTINATAIRE</div>
                      <div style={{ border: '1px solid #bbb', padding: '6px 8px', minHeight: 56, textAlign: 'left' }}>
                        <div style={{ fontWeight: 'bold', fontSize: 15 }}>{d.store_name}</div>
                        <div style={{ fontSize: 9, marginTop: 6, color: '#777' }}>
                          {copy === 1 ? 'Exemplaire enseigne' : 'Exemplaire livreur'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── RÉFÉRENCES ── */}
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 0, borderBottom: '1px solid #ccc', paddingBottom: 4, marginBottom: 4, fontSize: 10 }}>
                    <div>Réf. commande : <span style={{ display: 'inline-block', width: 70, borderBottom: '1px solid #000' }}>&nbsp;</span></div>
                    <div>Emballage : <span style={{ display: 'inline-block', width: 36, borderBottom: '1px solid #000' }}>&nbsp;</span></div>
                    <div>Port : <span style={{ display: 'inline-block', width: 36, borderBottom: '1px solid #000' }}>&nbsp;</span></div>
                  </div>
                  <div style={{ fontSize: 10, borderBottom: '1px solid #ccc', paddingBottom: 4, marginBottom: 8 }}>
                    Conditions de paiement : <span style={{ display: 'inline-block', width: 180, borderBottom: '1px solid #000' }}>&nbsp;</span>
                  </div>

                  {/* ── TABLEAU ── */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
                    <thead>
                      <tr>
                        <th style={cell({ width: 70, textAlign: 'center', background: '#e8e8e8', fontWeight: 'bold' })}>Date</th>
                        <th style={cell({ textAlign: 'left', background: '#e8e8e8', fontWeight: 'bold' })}>Description</th>
                        <th style={cell({ width: 80, textAlign: 'center', background: '#e8e8e8', fontWeight: 'bold' })}>Produit retourné</th>
                        <th style={cell({ width: 50, textAlign: 'center', background: '#e8e8e8', fontWeight: 'bold' })}>Qté</th>
                        <th style={cell({ width: 80, textAlign: 'center', background: '#e8e8e8', fontWeight: 'bold' })}>Signature</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={cell({ textAlign: 'center', padding: '8px 6px' })}>
                          {format(new Date(d.delivery_date.slice(0, 10) + 'T12:00:00'), 'dd/MM/yy', { locale: fr })}
                        </td>
                        <td style={cell({ padding: '8px 8px', fontWeight: 'bold' })}>
                          {d.quantity_delivered} paquets
                        </td>
                        <td style={cell({ padding: '8px 6px' })}>&nbsp;</td>
                        <td style={cell({ padding: '8px 6px' })}>&nbsp;</td>
                        <td style={cell({ padding: '8px 6px' })}>&nbsp;</td>
                      </tr>
                      {/* Lignes vides */}
                      {[1, 2, 3, 4, 5].map((i) => (
                        <tr key={i}>
                          <td style={cell({ padding: '14px 6px' })}>&nbsp;</td>
                          <td style={cell({ padding: '14px 6px' })}>&nbsp;</td>
                          <td style={cell({ padding: '14px 6px' })}>&nbsp;</td>
                          <td style={cell({ padding: '14px 6px' })}>&nbsp;</td>
                          <td style={cell({ padding: '14px 6px' })}>&nbsp;</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={3} style={cell({ textAlign: 'right', fontWeight: 'bold', background: '#f5f5f5', fontSize: 11 })}>
                          Reçu les marchandises ci-dessus en bon état
                        </td>
                        <td style={cell({ background: '#f5f5f5' })}>&nbsp;</td>
                        <td style={cell({ textAlign: 'center', fontSize: 9, background: '#f5f5f5' })}>
                          Signature :
                        </td>
                      </tr>
                    </tfoot>
                  </table>

                  {/* ── PIED ── */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: 10, marginTop: 6 }}>
                    <div>
                      A <span style={{ display: 'inline-block', width: 100, borderBottom: '1px solid #000' }}>&nbsp;</span>
                      &nbsp; le <span style={{ display: 'inline-block', width: 80, borderBottom: '1px solid #000' }}>&nbsp;</span>
                    </div>
                    <div style={{ fontSize: 9, color: '#777', textAlign: 'right', maxWidth: 220 }}>
                      Nous nous réservons la propriété des marchandises jusqu'au paiement intégral de notre facture.
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal : créer */}
      {showForm && (
        <Modal title="Nouvelle livraison" onClose={() => setShowForm(false)}>
          <DeliveryForm
            stores={stores}
            onSubmit={async (data) => {
              setCreating(true);
              await createMutation.mutateAsync(data);
              setCreating(false);
            }}
            onCancel={() => setShowForm(false)}
            loading={creating}
          />
        </Modal>
      )}

      {/* Modal : modifier */}
      {editDel && (
        <Modal title="Modifier la livraison" onClose={() => setEditDel(null)}>
          <DeliveryForm
            stores={stores}
            initial={editDel}
            onSubmit={async (data) => {
              await updateMutation.mutateAsync({ id: editDel.id, data });
            }}
            onCancel={() => setEditDel(null)}
            loading={updateMutation.isPending}
          />
        </Modal>
      )}
    </div>
  );
}

function DeliveryRow({
  delivery: d,
  onToggle,
  onEdit,
  onDelete,
}: {
  delivery: Delivery;
  onToggle:  (d: Delivery) => void;
  onEdit:    (d: Delivery) => void;
  onDelete:  (id: number) => void;
}) {
  const isOk = d.status === 'ok';
  return (
    <div className={`flex items-center gap-3 px-3 py-3 rounded-lg border transition ${
      isOk           ? 'bg-green-50 border-green-200' :
      d.is_recurring ? 'bg-purple-100 border-purple-400' :
                       'bg-white border-gray-200 hover:border-blue-300'
    }`}>
      <button
        onClick={() => onToggle(d)}
        className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition ${
          isOk ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-green-500'
        }`}
      >
        {isOk && '✓'}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-medium text-sm ${isOk ? 'text-green-800 line-through' : 'text-gray-800'}`}>
            {d.store_name}
          </span>
          <span className="text-xs text-gray-400">N°{d.delivery_number}</span>
          {d.is_recurring && (
            <span className="text-xs bg-purple-600 text-white rounded px-1 font-medium">R</span>
          )}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          Livré : {d.quantity_delivered}
          {d.quantity_recovered > 0 && ` — Récupéré : ${d.quantity_recovered}`}
          {' '}→ <strong>{d.total_quantity}</strong>
        </div>
      </div>

      <button
        onClick={() => onEdit(d)}
        className="text-gray-400 hover:text-blue-600 text-xs px-2 py-1 rounded transition"
      >
        Modifier
      </button>
      <button
        onClick={() => onDelete(d.id)}
        className="text-gray-400 hover:text-red-600 text-xs px-2 py-1 rounded transition"
      >
        Suppr.
      </button>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue:   'bg-blue-600 text-white',
    green:  'bg-emerald-500 text-white',
    orange: 'bg-orange-500 text-white',
    purple: 'bg-purple-600 text-white',
  };
  return (
    <div className={`rounded-xl p-4 shadow-sm ${colors[color]}`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-xs font-bold mt-1 opacity-90">{label}</div>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
