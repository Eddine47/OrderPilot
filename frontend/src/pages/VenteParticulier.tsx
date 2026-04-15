import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useReactToPrint } from 'react-to-print';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { salesApi } from '../api/sales';
import { productsApi } from '../api/products';
import { useAuth } from '../contexts/AuthContext';
import type { PrivateSale, PaymentMethod, Product, SaleItem } from '../types';
import { MONTH_NAMES } from '../types';

interface ItemRow {
  product_id: number | null;
  quantity: number;
  unit_price_ht: string;
  vat_rate: string;
}

function emptyRow(): ItemRow {
  return { product_id: null, quantity: 0, unit_price_ht: '', vat_rate: '' };
}

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

// ── Helpers calcul ──────────────────────────────────────────────────────────
function itemTotals(it: Pick<SaleItem, 'quantity' | 'unit_price_ht' | 'vat_rate'>) {
  const qty   = Number(it.quantity) || 0;
  const price = Number(it.unit_price_ht) || 0;
  const vat   = Number(it.vat_rate) || 0;
  const totalHt  = qty * price;
  const totalTtc = totalHt * (1 + vat / 100);
  return { qty, price, vat, totalHt, totalTtc };
}

function saleTotals(sale: PrivateSale) {
  const items = sale.items || [];
  const totalHt  = items.reduce((s, i) => s + itemTotals(i).totalHt, 0);
  const totalTtc = items.reduce((s, i) => s + itemTotals(i).totalTtc, 0);
  return { totalHt, totalTtc };
}

export default function VenteParticulier() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const now = new Date();

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year,  setYear]  = useState(now.getFullYear());
  const [paymentFilter, setPaymentFilter] = useState<'' | PaymentMethod>('');

  // Formulaire
  const [items,   setItems]   = useState<ItemRow[]>([emptyRow()]);
  const [payment, setPayment] = useState<PaymentMethod>('cash');
  const [notes,   setNotes]   = useState('');
  const [date,    setDate]    = useState(now.toISOString().slice(0, 10));
  const [error,   setError]   = useState('');

  const [saleToPrint, setSaleToPrint] = useState<PrivateSale | null>(null);
  const printRef        = useRef<HTMLDivElement>(null);
  const printMonthlyRef = useRef<HTMLDivElement>(null);

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['sales', month, year],
    queryFn:  () => salesApi.list(month, year).then((r) => r.data),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn:  () => productsApi.list().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: salesApi.create,
    onSuccess:  (res) => {
      qc.invalidateQueries({ queryKey: ['sales'] });
      setSaleToPrint(res.data);
      setItems([emptyRow()]);
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

  function updateItem(idx: number, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function addRow() { setItems((p) => [...p, emptyRow()]); }
  function removeRow(idx: number) {
    setItems((p) => (p.length === 1 ? p : p.filter((_, i) => i !== idx)));
  }
  function handleProductChange(idx: number, value: string) {
    if (value === '') { updateItem(idx, { product_id: null }); return; }
    const pid = Number(value);
    const p: Product | undefined = products.find((x) => x.id === pid);
    updateItem(idx, {
      product_id: pid,
      unit_price_ht: p ? String(p.unit_price_ht) : '',
      vat_rate: p ? String(p.vat_rate) : '',
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (items.length === 0 || items.every((it) => it.quantity <= 0)) {
      setError('Ajoutez au moins une ligne avec quantité > 0');
      return;
    }
    try {
      await createMutation.mutateAsync({
        sale_date: date,
        payment_method: payment,
        notes,
        items: items.map((it) => ({
          product_id: it.product_id,
          quantity: Number(it.quantity) || 0,
          unit_price_ht: it.unit_price_ht === '' ? null : Number(it.unit_price_ht),
          vat_rate:      it.vat_rate      === '' ? null : Number(it.vat_rate),
        })),
      });
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

  const formTotalQty = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);

  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-xl font-bold text-gray-800">Particulier</h1>
        <p className="text-gray-500 text-sm">Enregistrez et imprimez vos ventes directes</p>
      </div>

      {/* Formulaire */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="font-semibold text-gray-700 mb-4">Nouvelle vente</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
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

          {/* Lignes produits */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">Produits</label>
              <button
                type="button"
                onClick={addRow}
                className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100 transition"
              >
                + Ajouter un produit
              </button>
            </div>

            {items.map((it, idx) => (
              <div key={idx} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500">Ligne {idx + 1}</span>
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeRow(idx)} className="text-xs text-red-500 hover:text-red-700">
                      Supprimer
                    </button>
                  )}
                </div>
                <select
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
                  value={it.product_id ?? ''}
                  onChange={(e) => handleProductChange(idx, e.target.value)}
                >
                  <option value="">— Aucun produit —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">Quantité *</label>
                  <input
                    type="number"
                    min={1}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
                    value={it.quantity}
                    onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                    required
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Totaux */}
          <div className="bg-blue-50 rounded-lg p-3 text-sm space-y-1">
            <div>
              <span className="text-gray-600">Total : </span>
              <span className="font-bold text-blue-700 text-lg">{formTotalQty}</span>
              <span className="text-gray-600 ml-1">unités</span>
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
                  {s.items && s.items.length > 1 && (
                    <span className="text-xs text-gray-500">· {s.items.length} produits</span>
                  )}
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

      {/* Zones d'impression */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <div ref={printRef}>
          {saleToPrint && <SaleReceipt sale={saleToPrint} user={user} />}
        </div>
      </div>

      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <div ref={printMonthlyRef}>
          <MonthlyReport cardSales={cardSales} cashSales={cashSales} month={month} year={year} user={user} />
        </div>
      </div>
    </div>
  );
}

// ── Récap mensuel ────────────────────────────────────────────────────────────
function MonthlyReport({
  cardSales, cashSales, month, year, user,
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
    // On projette tous les items (1 ligne tableau = 1 item)
    type Row = { sale: PrivateSale; item: SaleItem; idx: number };
    const rows: Row[] = [];
    sales.forEach((s) => {
      (s.items || []).forEach((it) => rows.push({ sale: s, item: it, idx: rows.length + 1 }));
    });

    const hasPricing = rows.some((r) => Number(r.item.unit_price_ht) > 0);
    const totalQty = rows.reduce((s, r) => s + (Number(r.item.quantity) || 0), 0);
    const totalHt  = rows.reduce((s, r) => s + itemTotals(r.item).totalHt, 0);
    const totalTtc = rows.reduce((s, r) => s + itemTotals(r.item).totalTtc, 0);

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
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <div style={{ background: color, color: '#fff', fontWeight: 'bold', fontSize: 13, padding: '6px 18px', display: 'inline-block', letterSpacing: 0.8 }}>
            {title.toUpperCase()} — {periodLabel.toUpperCase()}
          </div>
        </div>

        <div style={{ border: '1px solid #ccc', padding: '8px 12px', marginBottom: 12, borderRadius: 4 }}>
          <div style={{ fontSize: 8, fontWeight: 'bold', textTransform: 'uppercase', color: '#555', marginBottom: 3 }}>VENDEUR</div>
          <div style={{ fontWeight: 'bold', fontSize: 13 }}>{user?.company_name ?? ''}</div>
          {user?.company_address && <div style={{ fontSize: 10, marginTop: 2, whiteSpace: 'pre-line' }}>{user.company_address}</div>}
          {user?.company_siret   && <div style={{ fontSize: 10, marginTop: 2 }}>Siret : {user.company_siret}</div>}
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
          <thead>
            <tr style={{ background }}>
              <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center', fontSize: 10, width: 32 }}>N°</th>
              <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center', fontSize: 10, width: 72 }}>Date</th>
              <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'left',   fontSize: 10 }}>Produit</th>
              <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center', fontSize: 10, width: 44 }}>Qté</th>
              {hasPricing && (
                <>
                  <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center', fontSize: 10, width: 54 }}>PU HT</th>
                  <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center', fontSize: 10, width: 56 }}>Total HT</th>
                  <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center', fontSize: 10, width: 38 }}>TVA</th>
                  <th style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center', fontSize: 10, width: 58 }}>Total TTC</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={hasPricing ? 8 : 4} style={{ border: '1px solid #bbb', padding: '14px 8px', textAlign: 'center', fontStyle: 'italic', color: '#888' }}>
                  Aucune vente
                </td>
              </tr>
            ) : rows.map(({ sale, item, idx }) => {
              const { price, vat, totalHt: ht, totalTtc: ttc } = itemTotals(item);
              return (
                <tr key={`${sale.id}-${item.id}`}>
                  <td style={{ border: '1px solid #bbb', padding: '5px 8px', textAlign: 'center', fontWeight: 'bold', color }}>{idx}</td>
                  <td style={{ border: '1px solid #bbb', padding: '5px 8px', textAlign: 'center' }}>
                    {format(new Date(String(sale.sale_date).slice(0, 10) + 'T12:00:00'), 'dd/MM/yyyy', { locale: fr })}
                  </td>
                  <td style={{ border: '1px solid #bbb', padding: '5px 8px' }}>
                    {item.product_name || 'Vente directe'}
                    {sale.notes && <div style={{ fontSize: 9, color: '#666', marginTop: 1 }}>{sale.notes}</div>}
                  </td>
                  <td style={{ border: '1px solid #bbb', padding: '5px 8px', textAlign: 'center', fontWeight: 'bold', color: GREEN }}>
                    {item.quantity}
                  </td>
                  {hasPricing && (
                    <>
                      <td style={{ border: '1px solid #bbb', padding: '5px 8px', textAlign: 'right' }}>{price > 0 ? `${price.toFixed(2)} €` : '—'}</td>
                      <td style={{ border: '1px solid #bbb', padding: '5px 8px', textAlign: 'right' }}>{price > 0 ? `${ht.toFixed(2)} €` : '—'}</td>
                      <td style={{ border: '1px solid #bbb', padding: '5px 8px', textAlign: 'center' }}>{price > 0 ? `${vat.toFixed(0)}%` : '—'}</td>
                      <td style={{ border: '1px solid #bbb', padding: '5px 8px', textAlign: 'right', fontWeight: 'bold' }}>{price > 0 ? `${ttc.toFixed(2)} €` : '—'}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: '#f5f5f5' }}>
              <td colSpan={3} style={{ border: '1px solid #bbb', padding: '7px 8px', textAlign: 'right', fontWeight: 'bold', fontSize: 11 }}>
                TOTAL {title.toUpperCase()}
              </td>
              <td style={{ border: '1px solid #bbb', padding: '7px 8px', textAlign: 'center', fontWeight: 'bold', fontSize: 14, color }}>
                {totalQty}
              </td>
              {hasPricing && (
                <>
                  <td style={{ border: '1px solid #bbb', background: '#f5f5f5' }}>&nbsp;</td>
                  <td style={{ border: '1px solid #bbb', padding: '7px 8px', textAlign: 'right', fontWeight: 'bold' }}>{totalHt.toFixed(2)} €</td>
                  <td style={{ border: '1px solid #bbb', background: '#f5f5f5' }}>&nbsp;</td>
                  <td style={{ border: '1px solid #bbb', padding: '7px 8px', textAlign: 'right', fontWeight: 'bold', color }}>{totalTtc.toFixed(2)} €</td>
                </>
              )}
            </tr>
          </tfoot>
        </table>

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

// ── Ticket individuel ────────────────────────────────────────────────────────
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

  const items = sale.items || [];
  const hasPricing = items.some((i) => Number(i.unit_price_ht) > 0);
  const totals = saleTotals(sale);

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

      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ background: GREEN, color: '#fff', fontWeight: 'bold', fontSize: 14, padding: '8px 20px', display: 'inline-block', letterSpacing: 1 }}>
          BON DE VENTE
        </div>
      </div>

      <div style={block}>
        <div style={{ fontSize: 8, fontWeight: 'bold', textTransform: 'uppercase', color: '#555', marginBottom: 4 }}>VENDEUR</div>
        <div style={{ fontWeight: 'bold', fontSize: 13 }}>{user?.company_name ?? ''}</div>
        {user?.company_address && <div style={{ fontSize: 10, marginTop: 2, whiteSpace: 'pre-line' }}>{user.company_address}</div>}
        {user?.company_siret   && <div style={{ fontSize: 10, marginTop: 2 }}>Siret : {user.company_siret}</div>}
      </div>

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

      <div style={{ ...block, borderColor: isCard ? '#2563eb' : '#059669', background: isCard ? '#eff6ff' : '#f0fdf4' }}>
        <div style={{ fontSize: 8, fontWeight: 'bold', textTransform: 'uppercase', color: '#555', marginBottom: 4 }}>MODE DE PAIEMENT</div>
        <div style={{ fontWeight: 'bold', fontSize: 13, color: isCard ? '#1d4ed8' : '#065f46' }}>
          {isCard ? '💳 Paiement bancaire (carte)' : '💵 Paiement en espèces'}
        </div>
      </div>

      {/* Tableau des items */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
        <thead>
          <tr style={{ background: '#e8e8e8' }}>
            <th style={{ border: '1px solid #bbb', padding: '5px 8px', textAlign: 'center', fontSize: 10, width: 32 }}>N°</th>
            <th style={{ border: '1px solid #bbb', padding: '5px 8px', textAlign: 'left', fontSize: 10 }}>Produit</th>
            <th style={{ border: '1px solid #bbb', padding: '5px 8px', textAlign: 'center', fontSize: 10, width: 50 }}>Qté</th>
            {hasPricing && (
              <>
                <th style={{ border: '1px solid #bbb', padding: '5px 8px', textAlign: 'center', fontSize: 10, width: 60 }}>PU HT</th>
                <th style={{ border: '1px solid #bbb', padding: '5px 8px', textAlign: 'center', fontSize: 10, width: 60 }}>Total HT</th>
                <th style={{ border: '1px solid #bbb', padding: '5px 8px', textAlign: 'center', fontSize: 10, width: 40 }}>TVA</th>
                <th style={{ border: '1px solid #bbb', padding: '5px 8px', textAlign: 'center', fontSize: 10, width: 62 }}>Total TTC</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => {
            const { price, vat, totalHt, totalTtc } = itemTotals(it);
            return (
              <tr key={it.id ?? idx}>
                <td style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center', fontWeight: 'bold', color: GREEN }}>{idx + 1}</td>
                <td style={{ border: '1px solid #bbb', padding: '6px 8px' }}>
                  {it.product_name || (isCard ? 'Vente directe — paiement bancaire' : 'Vente directe — espèces')}
                  {idx === 0 && sale.notes && <div style={{ fontSize: 9, color: '#666', fontWeight: 'normal', marginTop: 2 }}>{sale.notes}</div>}
                </td>
                <td style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center', fontWeight: 'bold', color: GREEN }}>{it.quantity}</td>
                {hasPricing && (
                  <>
                    <td style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'right' }}>{price > 0 ? `${price.toFixed(2)} €` : '—'}</td>
                    <td style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'right' }}>{price > 0 ? `${totalHt.toFixed(2)} €` : '—'}</td>
                    <td style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center' }}>{price > 0 ? `${vat.toFixed(0)}%` : '—'}</td>
                    <td style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'right', fontWeight: 'bold' }}>{price > 0 ? `${totalTtc.toFixed(2)} €` : '—'}</td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ background: '#f5f5f5' }}>
            <td colSpan={2} style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'right', fontWeight: 'bold', fontSize: 11 }}>TOTAL</td>
            <td style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'center', fontWeight: 'bold', fontSize: 14, color: GREEN }}>
              {sale.quantity}
            </td>
            {hasPricing && (
              <>
                <td style={{ border: '1px solid #bbb', background: '#f5f5f5' }}>&nbsp;</td>
                <td style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'right', fontWeight: 'bold' }}>{totals.totalHt.toFixed(2)} €</td>
                <td style={{ border: '1px solid #bbb', background: '#f5f5f5' }}>&nbsp;</td>
                <td style={{ border: '1px solid #bbb', padding: '6px 8px', textAlign: 'right', fontWeight: 'bold', color: GREEN }}>{totals.totalTtc.toFixed(2)} €</td>
              </>
            )}
          </tr>
        </tfoot>
      </table>

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
