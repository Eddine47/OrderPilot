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
import type { Delivery, RecurringRule, UpcomingDay } from '../types';
import { MONTH_NAMES } from '../types';

export default function Dashboard() {
  const qc      = useQueryClient();
  const { user } = useAuth();
  const today   = new Date();

  const [showForm,     setShowForm]     = useState(false);
  const [editDel,      setEditDel]      = useState<Delivery | null>(null);
  const [creating,     setCreating]     = useState(false);
  const [dismissed,    setDismissed]    = useState<number[]>([]);
  // Jour sélectionné dans le navigateur (0 = aujourd'hui, 1..7 = J+1..J+7)
  const [dayOffset,    setDayOffset]    = useState(0);
  // Quel jour est sélectionné pour l'impression (bons futurs)
  const [printDay,     setPrintDay]     = useState<string | null>(null);

  const printTodayRef   = useRef<HTMLDivElement>(null);
  const printUpcomingRef = useRef<HTMLDivElement>(null);

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

  const { data: upcomingDays = [] } = useQuery({
    queryKey: ['deliveries', 'upcoming'],
    queryFn:  () => deliveriesApi.upcoming(8).then((r) => r.data),
  });

  // Règles récurrentes qui correspondent à aujourd'hui et sans livraison existante
  // Number() assure la comparaison numérique même si day_of_month arrive en string
  const todayDay = today.getDate();
  const pendingRecurring: RecurringRule[] = recurringRules.filter(
    (r) =>
      r.is_active &&
      Number(r.day_of_month) === todayDay &&
      !dismissed.includes(r.id) &&
      !todayDeliveries.some((d) => d.store_id === r.store_id),
  );

  // ── Impression bon du jour ──────────────────────────────────────────────────
  const handlePrintToday = useReactToPrint({
    content:      () => printTodayRef.current,
    documentTitle: `Bon-journalier-${today.toISOString().slice(0, 10)}`,
    copyStyles:   false,
    pageStyle: `@page { margin: 10mm; } body { margin: 0; }`,
  });

  // ── Impression bon d'un jour futur ─────────────────────────────────────────
  const handlePrintUpcoming = useReactToPrint({
    content:      () => printUpcomingRef.current,
    documentTitle: `Bon-prevision-${printDay ?? ''}`,
    copyStyles:   false,
    pageStyle: `@page { margin: 10mm; } body { margin: 0; }`,
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
      qc.invalidateQueries({ queryKey: ['deliveries', 'upcoming'] });
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof deliveriesApi.create>[0]) =>
      deliveriesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deliveries', 'today'] });
      qc.invalidateQueries({ queryKey: ['monthly-total'] });
      qc.invalidateQueries({ queryKey: ['deliveries', 'upcoming'] });
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof deliveriesApi.update>[1] }) =>
      deliveriesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deliveries', 'today'] });
      qc.invalidateQueries({ queryKey: ['monthly-total'] });
      qc.invalidateQueries({ queryKey: ['deliveries', 'upcoming'] });
      setEditDel(null);
    },
  });

  function confirmRecurring(rule: RecurringRule) {
    createMutation.mutate({
      store_id:      rule.store_id,
      delivery_date: today.toISOString().slice(0, 10),
      items: [{
        product_id: null,
        quantity_delivered: rule.quantity,
        quantity_recovered: 0,
        unit_price_ht: null,
        vat_rate: null,
      }],
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

  // Jour sélectionné via le navigateur
  const selectedDay: UpcomingDay | undefined = upcomingDays[dayOffset];
  const isTodaySelected = dayOffset === 0;
  const selectedDeliveries = isTodaySelected ? todayDeliveries : (selectedDay?.deliveries ?? []);
  const selectedPlanned    = selectedDay?.planned ?? [];
  const selectedDayTotal   = selectedDeliveries.reduce((s, d) => s + d.total_quantity, 0);
  const selectedDateStr    = selectedDay?.date ?? today.toISOString().slice(0, 10);
  const selectedLabel      = format(new Date(selectedDateStr + 'T12:00:00'), 'EEEE d MMMM', { locale: fr })
    .replace(/^\w/, (c) => c.toUpperCase());

  // Deliveries à imprimer pour le jour sélectionné dans la preview
  const upcomingDayToPrint = upcomingDays.find((d) => d.date === printDay);

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
            onClick={canPrint ? handlePrintToday : undefined}
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

      {/* Carte livraisons du jour sélectionné (avec navigateur J → J+7) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
          <div>
            <h2 className="font-semibold text-gray-800">
              {isTodaySelected ? "Livraisons aujourd'hui" : `Livraisons du ${selectedLabel}`}
            </h2>
            <div className="text-xs text-gray-500 mt-0.5">
              {isTodaySelected ? (
                <>
                  {done.length} / {todayDeliveries.length} validées
                  {dayTotal > 0 && <span className="ml-2 font-semibold text-blue-700">· Total : {dayTotal}</span>}
                </>
              ) : (
                <>
                  {selectedDeliveries.length} livraison{selectedDeliveries.length > 1 ? 's' : ''}
                  {selectedPlanned.length > 0 && ` · ${selectedPlanned.length} prévue${selectedPlanned.length > 1 ? 's' : ''}`}
                  {selectedDayTotal > 0 && <span className="ml-2 font-semibold text-blue-700">· Total : {selectedDayTotal}</span>}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Navigateur J → J+7 */}
        {upcomingDays.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
            <button
              onClick={() => setDayOffset(0)}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                dayOffset === 0 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Aujourd'hui
            </button>
            {upcomingDays.slice(1, 8).map((day, i) => {
              const idx = i + 1;
              const d = new Date(day.date + 'T12:00:00');
              const count = day.deliveries.length + day.planned.length;
              const active = dayOffset === idx;
              return (
                <button
                  key={day.date}
                  onClick={() => setDayOffset(idx)}
                  className={`flex-shrink-0 flex flex-col items-center text-xs px-2.5 py-1 rounded-lg transition ${
                    active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  title={format(d, 'EEEE d MMMM', { locale: fr })}
                >
                  <span className="font-semibold">J+{idx}</span>
                  <span className={`text-[10px] ${active ? 'text-blue-100' : 'text-gray-500'}`}>
                    {format(d, 'dd/MM', { locale: fr })}
                    {count > 0 && <span className={`ml-1 font-semibold ${active ? 'text-white' : 'text-blue-700'}`}>· {count}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Contenu : aujourd'hui (interactif) vs jour futur (lecture + impression) */}
        {isTodaySelected ? (
          isLoading ? (
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
          )
        ) : (
          <div className="space-y-2">
            {selectedDeliveries.length === 0 && selectedPlanned.length === 0 ? (
              <div className="text-center py-8 text-gray-400">Aucune livraison prévue ce jour</div>
            ) : (
              <>
                {selectedDeliveries.map((d) => (
                  <div key={d.id} className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-gray-50 border border-gray-200">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${d.status === 'ok' ? 'bg-green-500' : 'bg-blue-400'}`} />
                    <span className="font-medium text-gray-800">{d.store_name}</span>
                    <span className="text-xs text-gray-500">— {d.quantity_delivered} paquets</span>
                    {d.quantity_recovered > 0 && (
                      <span className="text-xs text-orange-600">retourné : {d.quantity_recovered}</span>
                    )}
                    <span className="text-blue-700 font-semibold ml-auto text-sm">= {d.total_quantity}</span>
                  </div>
                ))}
                {selectedPlanned.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-purple-50 border border-purple-200">
                    <span className="w-2 h-2 rounded-full flex-shrink-0 bg-purple-400" />
                    <span className="font-medium text-gray-700">{r.store_name}</span>
                    <span className="text-xs text-purple-600">— {r.quantity} paquets prévus</span>
                    <span className="text-xs bg-purple-100 text-purple-600 rounded px-1 ml-auto font-medium">R</span>
                  </div>
                ))}
                {selectedDeliveries.length > 0 && (
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => { setPrintDay(selectedDateStr); setTimeout(handlePrintUpcoming, 100); }}
                      className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition"
                    >
                      Imprimer bons — {selectedLabel}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Zone d'impression bon du jour ──────────────────────────────────── */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <div ref={printTodayRef} style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 11, color: '#000', background: '#fff' }}>
          <PrintSlips deliveries={todayDeliveries} dateLabel={todayLabel} user={user} />
        </div>
      </div>

      {/* ── Zone d'impression bon jour futur ───────────────────────────────── */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <div ref={printUpcomingRef} style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 11, color: '#000', background: '#fff' }}>
          {upcomingDayToPrint && (
            <PrintSlips
              deliveries={upcomingDayToPrint.deliveries}
              dateLabel={format(new Date(upcomingDayToPrint.date + 'T12:00:00'), 'EEEE d MMMM yyyy', { locale: fr }).replace(/^\w/, (c) => c.toUpperCase())}
              user={user}
            />
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

// ── Composant d'impression partagé ─────────────────────────────────────────────
function PrintSlips({
  deliveries,
  dateLabel,
  user,
}: {
  deliveries: Delivery[];
  dateLabel: string;
  user: { company_name?: string; company_address?: string; company_siret?: string } | null;
}) {
  const GREEN = '#1a6b3c';
  const cell = (extra?: React.CSSProperties): React.CSSProperties => ({
    border: '1px solid #bbb', padding: '4px 8px', fontSize: 11, ...extra,
  });

  return (
    <>
      {deliveries.map((d, idx) => {
          const isLastPage = idx === deliveries.length - 1;
          return (
            <div key={d.id} style={{
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
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase', color: '#555', border: '1px solid #bbb', padding: '2px 6px' }}>DATE</span>
                    <span style={{ fontSize: 13, fontWeight: 'bold' }}>{dateLabel}</span>
                  </div>
                  <div style={{ fontSize: 8, fontWeight: 'bold', textTransform: 'uppercase', color: '#555', marginBottom: 3 }}>EXPÉDITEUR</div>
                  <div style={{ border: '1px solid #bbb', padding: '6px 8px', minHeight: 56 }}>
                    <div style={{ fontWeight: 'bold', fontSize: 12 }}>{user?.company_name}</div>
                    {user?.company_address && <div style={{ fontSize: 10, marginTop: 2, whiteSpace: 'pre-line' }}>{user.company_address}</div>}
                    {user?.company_siret   && <div style={{ fontSize: 10, marginTop: 2 }}>Siret : {user.company_siret}</div>}
                  </div>
                </div>
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
                  </div>
                </div>
              </div>

              {/* ── RÉFÉRENCES ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 0, borderBottom: '1px solid #ccc', paddingBottom: 4, marginBottom: 4, fontSize: 10 }}>
                <div>
                  Réf. commande :&nbsp;
                  {d.order_reference
                    ? <strong>{d.order_reference}</strong>
                    : <span style={{ display: 'inline-block', width: 70, borderBottom: '1px solid #000' }}>&nbsp;</span>
                  }
                </div>
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
                    <th style={cell({ width: 80, textAlign: 'center', background: '#e8e8e8', fontWeight: 'bold' })}>N° commande</th>
                    <th style={cell({ width: 70, textAlign: 'center', background: '#e8e8e8', fontWeight: 'bold' })}>Date</th>
                    <th style={cell({ textAlign: 'left', background: '#e8e8e8', fontWeight: 'bold' })}>Description</th>
                    <th style={cell({ width: 70, textAlign: 'center', background: '#e8e8e8', fontWeight: 'bold' })}>Retourné</th>
                    <th style={cell({ width: 50, textAlign: 'center', background: '#e8e8e8', fontWeight: 'bold' })}>Qté</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={cell({ textAlign: 'center', padding: '8px 6px', fontSize: 10 })}>
                      {d.order_reference || '—'}
                    </td>
                    <td style={cell({ textAlign: 'center', padding: '8px 6px' })}>
                      {format(new Date(d.delivery_date.slice(0, 10) + 'T12:00:00'), 'dd/MM/yy', { locale: fr })}
                    </td>
                    <td style={cell({ padding: '8px 8px', fontWeight: 'bold' })}>
                      {d.quantity_delivered} paquets
                    </td>
                    <td style={cell({ textAlign: 'center', padding: '8px 6px' })}>
                      {d.quantity_recovered > 0 ? d.quantity_recovered : '—'}
                    </td>
                    <td style={cell({ textAlign: 'center', padding: '8px 6px', fontWeight: 'bold' })}>
                      {d.total_quantity}
                    </td>
                  </tr>
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
                    <td colSpan={2} style={cell({ textAlign: 'center', fontSize: 9, background: '#f5f5f5' })}>
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
        })}
    </>
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
          {d.order_reference && (
            <span className="text-xs text-blue-600 bg-blue-50 rounded px-1">{d.order_reference}</span>
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

