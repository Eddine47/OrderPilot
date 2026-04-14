import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useReactToPrint } from 'react-to-print';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { salesApi } from '../api/sales';
import { useAuth } from '../contexts/AuthContext';
import type { PrivateSale, PaymentMethod } from '../types';
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

export default function VenteParticulier() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const now = new Date();

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year,  setYear]  = useState(now.getFullYear());
  const [paymentFilter, setPaymentFilter] = useState<'' | PaymentMethod>('');

  // Formulaire nouvelle vente
  const [qty,     setQty]     = useState(0);
  const [payment, setPayment] = useState<PaymentMethod>('cash');
  const [notes,   setNotes]   = useState('');
  const [date,    setDate]    = useState(now.toISOString().slice(0, 10));
  const [error,   setError]   = useState('');

  // Vente à imprimer (ticket individuel)
  const [saleToPrint, setSaleToPrint] = useState<PrivateSale | null>(null);
  const printRef        = useRef<HTMLDivElement>(null);
  const printMonthlyRef = useRef<HTMLDivElement>(null);

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['sales', month, year],
    queryFn:  () => salesApi.list(month, year).then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: salesApi.create,
    onSuccess:  (res) => {
      qc.invalidateQueries({ queryKey: ['sales'] });
      setSaleToPrint(res.data);
      setQty(0);
      setNotes('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: salesApi.delete,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['sales'] }),
  });

  const handlePrint = useReactToPrint({
    content:     () => printRef.current,
    documentTitle: `Vente-${saleToPrint?.sale_date ?? date}-${payment}`,
    copyStyles:  false,
    pageStyle: `@page { margin: 15mm; } body { margin: 0; }`,
  });

  const handlePrintMonthly = useReactToPrint({
    content:      () => printMonthlyRef.current,
    documentTitle: `Ventes-${year}-${String(month).padStart(2, '0')}`,
    copyStyles:   false,
    pageStyle: `@page { margin: 15mm; } body { margin: 0; }`,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (qty <= 0) { setError('La quantité doit être > 0'); return; }
    try {
      await createMutation.mutateAsync({ sale_date: date, quantity: qty, payment_method: payment, notes });
    } catch {
      setError('Erreur lors de l\'enregistrement');
    }
  }

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];
  const monthTotal = sales.reduce((s, v) => s + v.quantity, 0);

  const cardSales = sales.filter((s) => s.payment_method === 'card');
  const cashSales = sales.filter((s) => s.payment_method === 'cash');
  const totalCard = cardSales.reduce((s, v) => s + v.quantity, 0);
  const totalCash = cashSales.reduce((s, v) => s + v.quantity, 0);

  const filteredSales = paymentFilter ? sales.filter((s) => s.payment_method === paymentFilter) : sales;

  return (
    <div className="space-y-6">

      {/* En-tête */}
      <div>
        <h1 className="text-xl font-bold text-gray-800">Particulier</h1>
        <p className="text-gray-500 text-sm">Enregistrez et imprimez vos ventes directes</p>
      </div>

      {/* Formulaire de saisie */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="font-semibold text-gray-700 mb-4">Nouvelle vente</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input
                type="date"
                lang="fr"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantité *</label>
              <input
                type="number"
                min={1}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
                required
              />
            </div>
          </div>

          {/* Mode de paiement */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mode de paiement *</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPayment('card')}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-medium text-sm transition ${
                  payment === 'card'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300'
                }`}
              >
                <span className="text-lg">💳</span> Carte bancaire
              </button>
              <button
                type="button"
                onClick={() => setPayment('cash')}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-medium text-sm transition ${
                  payment === 'cash'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-300'
                }`}
              >
                <span className="text-lg">💵</span> Espèces
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Remarque (optionnel)"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium"
          >
            {createMutation.isPending ? 'Enregistrement…' : 'Enregistrer et imprimer'}
          </button>
        </form>
      </div>

      {/* Historique */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-semibold text-gray-700">Historique des ventes</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={i + 1} value={i + 1}>{name}</option>
              ))}
            </select>
            <select
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as '' | PaymentMethod)}
            >
              <option value="">Tous paiements</option>
              <option value="card">Carte bancaire</option>
              <option value="cash">Espèces</option>
            </select>
            {sales.length > 0 && (
              <button
                onClick={handlePrintMonthly}
                className="text-sm bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition"
                title="Imprimer le récapitulatif du mois (CB + espèces)"
              >
                Imprimer le mois
              </button>
            )}
          </div>
        </div>

        {/* Résumé mois */}
        {sales.length > 0 && (
          <div className="px-4 py-3 border-b border-gray-100 flex gap-4 flex-wrap text-sm">
            <span className="text-gray-600">Total : <strong className="text-blue-700">{monthTotal}</strong></span>
            <span className="text-blue-600">💳 Carte : <strong>{totalCard}</strong></span>
            <span className="text-emerald-600">💵 Espèces : <strong>{totalCash}</strong></span>
          </div>
        )}

        <div className="divide-y divide-gray-100">
          {isLoading ? (
            <div className="text-center py-8 text-gray-400">Chargement…</div>
          ) : filteredSales.length === 0 ? (
            <div className="text-center py-8 text-gray-400">Aucune vente ce mois</div>
          ) : filteredSales.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-800">
                    {format(new Date(String(s.sale_date).slice(0, 10) + 'T12:00:00'), 'dd/MM/yyyy', { locale: fr })}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    s.payment_method === 'card'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {s.payment_method === 'card' ? '💳 Carte' : '💵 Espèces'}
                  </span>
                  <span className="font-bold text-blue-700">{s.quantity} unité{s.quantity > 1 ? 's' : ''}</span>
                </div>
                {s.notes && <p className="text-xs text-gray-400 mt-0.5">{s.notes}</p>}
              </div>
              <button
                onClick={() => { setSaleToPrint(s); setTimeout(handlePrint, 100); }}
                className="text-xs text-gray-400 hover:text-blue-600 px-2 py-1 rounded transition"
              >
                Imprimer
              </button>
              <button
                onClick={() => window.confirm('Supprimer cette vente ?') && deleteMutation.mutate(s.id)}
                className="text-xs text-gray-400 hover:text-red-600 px-2 py-1 rounded transition"
              >
                Suppr.
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Zone d'impression (hors écran) */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <div ref={printRef}>
          {saleToPrint && (
            <SaleReceipt sale={saleToPrint} user={user} />
          )}
        </div>
      </div>

      {/* Zone d'impression récap mensuel (hors écran) */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <div ref={printMonthlyRef}>
          <MonthlyReport
            cardSales={cardSales}
            cashSales={cashSales}
            month={month}
            year={year}
            user={user}
          />
        </div>
      </div>
    </div>
  );
}

// ── Récapitulatif mensuel (CB + espèces sur 2 pages) ──────────────────────────
function MonthlyReport({
  cardSales,
  cashSales,
  month,
  year,
  user,
}: {
  cardSales: PrivateSale[];
  cashSales: PrivateSale[];
  month: number;
  year: number;
  user: { company_name?: string; company_address?: string; company_siret?: string } | null;
}) {
  const GREEN = '#1a6b3c';
  const periodLabel = `${MONTH_NAMES[month - 1]} ${year}`;

  const renderPage = (
    sales: PrivateSale[],
    title: string,
    color: string,
    background: string,
    isLast: boolean,
  ) => {
    const total = sales.reduce((s, v) => s + v.quantity, 0);
    return (
      <div style={{
        pageBreakAfter: isLast ? 'avoid' : 'always',
        breakAfter:     isLast ? 'avoid' : 'page',
        padding: '18mm 14mm',
        background: '#fff',
        color: '#000',
        boxSizing: 'border-box',
        width: '100%',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: 11,
      }}>
        {/* En-tête */}
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <div style={{ background: color, color: '#fff', fontWeight: 'bold', fontSize: 13, padding: '6px 18px', display: 'inline-block', letterSpacing: 0.8 }}>
            {title.toUpperCase()} — {periodLabel.toUpperCase()}
          </div>
        </div>

        {/* Vendeur */}
        <div style={{ border: '1px solid #ccc', padding: '8px 12px', marginBottom: 12, borderRadius: 4 }}>
          <div style={{ fontSize: 8, fontWeight: 'bold', textTransform: 'uppercase', color: '#555', marginBottom: 3 }}>VENDEUR</div>
          <div style={{ fontWeight: 'bold', fontSize: 13 }}>{user?.company_name ?? ''}</div>
          {user?.company_address && <div style={{ fontSize: 10, marginTop: 2, whiteSpace: 'pre-line' }}>{user.company_address}</div>}
          {user?.company_siret   && <div style={{ fontSize: 10, marginTop: 2 }}>Siret : {user.company_siret}</div>}
        </div>

        {/* Tableau */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
          <thead>
            <tr style={{ background }}>
              <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center', fontSize: 10, width: 48 }}>N°</th>
              <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center', fontSize: 10, width: 90 }}>Date</th>
              <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'left', fontSize: 10 }}>Description</th>
              <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center', fontSize: 10, width: 70 }}>Quantité</th>
            </tr>
          </thead>
          <tbody>
            {sales.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ border: '1px solid #bbb', padding: '14px 8px', textAlign: 'center', fontStyle: 'italic', color: '#888' }}>
                  Aucune vente
                </td>
              </tr>
            ) : sales.map((s, idx) => (
              <tr key={s.id}>
                <td style={{ border: '1px solid #bbb', padding: '5px 8px', textAlign: 'center', fontWeight: 'bold', color }}>{idx + 1}</td>
                <td style={{ border: '1px solid #bbb', padding: '5px 8px', textAlign: 'center' }}>
                  {format(new Date(String(s.sale_date).slice(0, 10) + 'T12:00:00'), 'dd/MM/yyyy', { locale: fr })}
                </td>
                <td style={{ border: '1px solid #bbb', padding: '5px 8px' }}>
                  Vente directe — {title.toLowerCase()}
                  {s.notes && <div style={{ fontSize: 9, color: '#666', marginTop: 1 }}>{s.notes}</div>}
                </td>
                <td style={{ border: '1px solid #bbb', padding: '5px 8px', textAlign: 'center', fontWeight: 'bold', color: GREEN }}>
                  {s.quantity}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#f5f5f5' }}>
              <td colSpan={3} style={{ border: '1px solid #bbb', padding: '7px 8px', textAlign: 'right', fontWeight: 'bold', fontSize: 11 }}>
                TOTAL {title.toUpperCase()}
              </td>
              <td style={{ border: '1px solid #bbb', padding: '7px 8px', textAlign: 'center', fontWeight: 'bold', fontSize: 14, color }}>
                {total}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Pied */}
        <div style={{ marginTop: 14, fontSize: 10, color: '#555' }}>
          {sales.length} opération{sales.length > 1 ? 's' : ''} · Période {periodLabel}
        </div>
      </div>
    );
  };

  return (
    <>
      {renderPage(cardSales, 'Ventes Carte Bancaire', '#1d4ed8', '#dbeafe', false)}
      {renderPage(cashSales, 'Ventes Espèces',         '#065f46', '#d1fae5', true)}
    </>
  );
}

// ── Ticket de vente ────────────────────────────────────────────────────────────
function SaleReceipt({
  sale,
  user,
}: {
  sale: PrivateSale;
  user: { company_name?: string; company_address?: string; company_siret?: string } | null;
}) {
  const isCard = sale.payment_method === 'card';
  const GREEN  = '#1a6b3c';
  const dateStr = String(sale.sale_date).slice(0, 10);
  const dateLabel = format(new Date(dateStr + 'T12:00:00'), 'dd MMMM yyyy', { locale: fr });

  const block: React.CSSProperties = {
    border: '1px solid #ccc',
    padding: '10px 14px',
    marginBottom: 12,
    borderRadius: 4,
    fontFamily: 'Arial, Helvetica, sans-serif',
    fontSize: 11,
    color: '#000',
    background: '#fff',
  };

  return (
    <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 11, color: '#000', background: '#fff', padding: '20mm 16mm', boxSizing: 'border-box' }}>

      {/* Titre */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ background: GREEN, color: '#fff', fontWeight: 'bold', fontSize: 14, padding: '8px 20px', display: 'inline-block', letterSpacing: 1 }}>
          BON DE VENTE
        </div>
      </div>

      {/* Vendeur */}
      <div style={block}>
        <div style={{ fontSize: 8, fontWeight: 'bold', textTransform: 'uppercase', color: '#555', marginBottom: 4 }}>VENDEUR</div>
        <div style={{ fontWeight: 'bold', fontSize: 13 }}>{user?.company_name ?? ''}</div>
        {user?.company_address && <div style={{ fontSize: 10, marginTop: 2, whiteSpace: 'pre-line' }}>{user.company_address}</div>}
        {user?.company_siret   && <div style={{ fontSize: 10, marginTop: 2 }}>Siret : {user.company_siret}</div>}
      </div>

      {/* Acheteur + date */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div style={block}>
          <div style={{ fontSize: 8, fontWeight: 'bold', textTransform: 'uppercase', color: '#555', marginBottom: 4 }}>ACHETEUR</div>
          <div style={{ fontWeight: 'bold' }}>Acheteur divers</div>
        </div>
        <div style={block}>
          <div style={{ fontSize: 8, fontWeight: 'bold', textTransform: 'uppercase', color: '#555', marginBottom: 4 }}>DATE</div>
          <div style={{ fontWeight: 'bold' }}>{dateLabel}</div>
        </div>
      </div>

      {/* Mode de paiement */}
      <div style={{ ...block, borderColor: isCard ? '#2563eb' : '#059669', background: isCard ? '#eff6ff' : '#f0fdf4' }}>
        <div style={{ fontSize: 8, fontWeight: 'bold', textTransform: 'uppercase', color: '#555', marginBottom: 4 }}>MODE DE PAIEMENT</div>
        <div style={{ fontWeight: 'bold', fontSize: 13, color: isCard ? '#1d4ed8' : '#065f46' }}>
          {isCard ? '💳 Paiement bancaire (carte)' : '💵 Paiement en espèces'}
        </div>
      </div>

      {/* Détail de la vente */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
        <thead>
          <tr style={{ background: '#e8e8e8' }}>
            <th style={{ border: '1px solid #bbb', padding: '5px 8px', textAlign: 'left', fontSize: 10 }}>Description</th>
            <th style={{ border: '1px solid #bbb', padding: '5px 8px', textAlign: 'center', fontSize: 10, width: 60 }}>Quantité</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ border: '1px solid #bbb', padding: '8px 8px', fontWeight: 'bold' }}>
              Vente directe — {isCard ? 'Acheteur divers paiement bancaire' : 'Acheteur divers espèces'}
              {sale.notes && <div style={{ fontSize: 9, color: '#666', fontWeight: 'normal', marginTop: 2 }}>{sale.notes}</div>}
            </td>
            <td style={{ border: '1px solid #bbb', padding: '8px 8px', textAlign: 'center', fontWeight: 'bold', fontSize: 14, color: GREEN }}>
              {sale.quantity}
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr style={{ background: '#f5f5f5' }}>
            <td style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'right', fontWeight: 'bold', fontSize: 11 }}>
              TOTAL
            </td>
            <td style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center', fontWeight: 'bold', fontSize: 15, color: GREEN }}>
              {sale.quantity}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Pied */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginTop: 16 }}>
        <div>
          Fait à <span style={{ display: 'inline-block', width: 100, borderBottom: '1px solid #000' }}>&nbsp;</span>
          &nbsp; le {dateLabel}
        </div>
        <div style={{ textAlign: 'right', fontSize: 9, color: '#777', maxWidth: 200 }}>
          Document établi par {user?.company_name ?? ''}
        </div>
      </div>
    </div>
  );
}
