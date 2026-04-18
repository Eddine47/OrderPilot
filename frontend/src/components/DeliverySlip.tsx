import { forwardRef } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { MonthlySlip, DeliveryItem } from '../types';
import { MONTH_NAMES } from '../types';

interface Props { slip: MonthlySlip; }

const DeliverySlip = forwardRef<HTMLDivElement, Props>(({ slip }, ref) => {
  const { store, user, month, year, deliveries, grand_total } = slip;
  const showReturns = store.has_returns ?? false;

  // On aplatit les livraisons en lignes (1 ligne = 1 item)
  type FlatRow = {
    deliveryId: number;
    itemId: number;
    number: number;
    date: string;
    orderRef?: string;
    item: DeliveryItem;
  };
  const rows: FlatRow[] = [];
  deliveries.forEach((d) => {
    (d.items || []).forEach((it) => {
      rows.push({
        deliveryId: d.id,
        itemId: it.id,
        number: d.delivery_number,
        date: d.delivery_date,
        orderRef: d.order_reference,
        item: it,
      });
    });
  });

  const showPricing = rows.some((r) => Number(r.item.unit_price_ht) > 0);

  const itemTotals = (it: DeliveryItem) => {
    const retourne = it.quantity_recovered ?? 0;
    const qty      = (it.quantity_delivered ?? 0) - retourne;
    const price    = Number(it.unit_price_ht) || 0;
    const vat      = Number(it.vat_rate)      || 0;
    const totalHt  = qty * price;
    const totalTtc = totalHt * (1 + vat / 100);
    return { retourne, qty, price, vat, totalHt, totalTtc };
  };

  const grandTotalHt  = rows.reduce((s, r) => s + itemTotals(r.item).totalHt, 0);
  const grandTotalTtc = rows.reduce((s, r) => s + itemTotals(r.item).totalTtc, 0);

  const GREEN = '#1a6b3c';

  const cell = (extra?: React.CSSProperties): React.CSSProperties => ({
    border: '1px solid #bbb',
    padding: '4px 6px',
    fontSize: 10,
    ...extra,
  });

  const MIN_ROWS = 15;
  const padCount = Math.max(0, MIN_ROWS - rows.length);

  return (
    <div ref={ref} style={{
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: 11,
      color: '#000',
      background: '#fff',
      padding: '16mm 14mm',
      boxSizing: 'border-box',
      width: '100%',
    }}>

      {/* EN-TÊTE */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase', color: '#555', border: '1px solid #bbb', padding: '2px 6px' }}>PÉRIODE</span>
            <span style={{ fontSize: 13, fontWeight: 'bold' }}>{MONTH_NAMES[month - 1]} {year}</span>
          </div>
          <div style={{ fontSize: 8, fontWeight: 'bold', textTransform: 'uppercase', color: '#555', marginBottom: 3 }}>EXPÉDITEUR</div>
          <div style={{ border: '1px solid #bbb', padding: '6px 8px', minHeight: 60 }}>
            <div style={{ fontWeight: 'bold', fontSize: 12 }}>{user.company_name}</div>
            {user.company_address && <div style={{ fontSize: 10, marginTop: 2, whiteSpace: 'pre-line' }}>{user.company_address}</div>}
            {user.company_siret && <div style={{ fontSize: 10, marginTop: 2 }}>Siret : {user.company_siret}</div>}
          </div>
        </div>

        <div style={{ flex: 1, textAlign: 'right', paddingLeft: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 6 }}>
            <div style={{ background: GREEN, color: '#fff', fontWeight: 'bold', fontSize: 13, padding: '6px 14px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              BON LIVRAISON MENSUEL
            </div>
          </div>
          <div style={{ fontSize: 8, fontWeight: 'bold', textTransform: 'uppercase', color: '#555', marginBottom: 3 }}>DESTINATAIRE</div>
          <div style={{ border: '1px solid #bbb', padding: '6px 8px', minHeight: 60, textAlign: 'left' }}>
            <div style={{ fontWeight: 'bold', fontSize: 13 }}>{store.name}</div>
            {store.address      && <div style={{ fontSize: 10, marginTop: 2 }}>{store.address}</div>}
            {store.contact_name && <div style={{ fontSize: 10, marginTop: 2 }}>{store.contact_name}</div>}
            {store.contact_phone && <div style={{ fontSize: 10 }}>{store.contact_phone}</div>}
          </div>
        </div>
      </div>

      {/* RÉFÉRENCES */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 0, borderBottom: '1px solid #ccc', paddingBottom: 4, marginBottom: 4, fontSize: 10 }}>
        <div>Conditions de paiement : <span style={{ display: 'inline-block', width: 100, borderBottom: '1px solid #000' }}>&nbsp;</span></div>
        <div>Emballage : <span style={{ display: 'inline-block', width: 40, borderBottom: '1px solid #000' }}>&nbsp;</span></div>
        <div>Port : <span style={{ display: 'inline-block', width: 40, borderBottom: '1px solid #000' }}>&nbsp;</span></div>
      </div>

      {/* TABLEAU */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
        <thead>
          <tr>
            <th style={cell({ textAlign: 'center', width: 32, fontWeight: 'bold', background: '#e8e8e8' })}>N°</th>
            <th style={cell({ textAlign: 'center', width: 72, fontWeight: 'bold', background: '#e8e8e8' })}>Réf. cmd</th>
            <th style={cell({ textAlign: 'center', width: 60, fontWeight: 'bold', background: '#e8e8e8' })}>Date</th>
            <th style={cell({ textAlign: 'left', fontWeight: 'bold', background: '#e8e8e8' })}>Produit</th>
            <th style={cell({ textAlign: 'center', width: 50, fontWeight: 'bold', background: '#e8e8e8' })}>Qté livrée</th>
            {showReturns && <th style={cell({ textAlign: 'center', width: 50, fontWeight: 'bold', background: '#e8e8e8' })}>Retour</th>}
            <th style={cell({ textAlign: 'center', width: 58, fontWeight: 'bold', background: '#e8e8e8' })}>Qté totale livrée</th>
            {showPricing && (
              <>
                <th style={cell({ textAlign: 'center', width: 54, fontWeight: 'bold', background: '#e8e8e8' })}>PU HT</th>
                <th style={cell({ textAlign: 'center', width: 56, fontWeight: 'bold', background: '#e8e8e8' })}>Total HT</th>
                <th style={cell({ textAlign: 'center', width: 38, fontWeight: 'bold', background: '#e8e8e8' })}>TVA</th>
                <th style={cell({ textAlign: 'center', width: 58, fontWeight: 'bold', background: '#e8e8e8' })}>Total TTC</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => {
            const { retourne, qty, price, vat, totalHt, totalTtc } = itemTotals(r.item);
            const delivered = r.item.quantity_delivered ?? 0;
            return (
              <tr key={`${r.deliveryId}-${r.itemId}`}>
                <td style={cell({ textAlign: 'center', padding: '4px 4px', fontWeight: 'bold', color: GREEN })}>{idx + 1}</td>
                <td style={cell({ textAlign: 'center', padding: '4px 4px', fontSize: 9 })}>
                  {r.orderRef || '—'}
                </td>
                <td style={cell({ textAlign: 'center', padding: '4px 4px' })}>
                  {format(new Date(r.date.slice(0, 10) + 'T12:00:00'), 'dd/MM/yy', { locale: fr })}
                </td>
                <td style={cell({ padding: '4px 6px' })}>
                  {r.item.product_name
                    ? r.item.product_name
                    : `${delivered} paquet${delivered > 1 ? 's' : ''}`}
                </td>
                <td style={cell({ textAlign: 'center', padding: '4px 4px' })}>
                  {delivered}
                </td>
                {showReturns && (
                  <td style={cell({ textAlign: 'center', padding: '4px 4px', color: retourne > 0 ? '#c05600' : '#999' })}>
                    {retourne > 0 ? retourne : '—'}
                  </td>
                )}
                <td style={cell({ textAlign: 'center', padding: '4px 4px', fontWeight: 'bold', color: GREEN })}>
                  {qty}
                </td>
                {showPricing && (
                  <>
                    <td style={cell({ textAlign: 'right', padding: '4px 6px' })}>
                      {price > 0 ? `${price.toFixed(2)} €` : '—'}
                    </td>
                    <td style={cell({ textAlign: 'right', padding: '4px 6px' })}>
                      {price > 0 ? `${totalHt.toFixed(2)} €` : '—'}
                    </td>
                    <td style={cell({ textAlign: 'center', padding: '4px 4px' })}>
                      {price > 0 ? `${vat.toFixed(0)}%` : '—'}
                    </td>
                    <td style={cell({ textAlign: 'right', padding: '4px 6px', fontWeight: 'bold' })}>
                      {price > 0 ? `${totalTtc.toFixed(2)} €` : '—'}
                    </td>
                  </>
                )}
              </tr>
            );
          })}

          {Array.from({ length: padCount }).map((_, i) => (
            <tr key={`pad-${i}`}>
              <td style={cell({ padding: '9px 4px' })}>&nbsp;</td>
              <td style={cell({ padding: '9px 4px' })}>&nbsp;</td>
              <td style={cell({ padding: '9px 4px' })}>&nbsp;</td>
              <td style={cell({ padding: '9px 6px' })}>&nbsp;</td>
              <td style={cell({ padding: '9px 4px' })}>&nbsp;</td>
              {showReturns && <td style={cell({ padding: '9px 4px' })}>&nbsp;</td>}
              <td style={cell({ padding: '9px 4px' })}>&nbsp;</td>
              {showPricing && (
                <>
                  <td style={cell({ padding: '9px 4px' })}>&nbsp;</td>
                  <td style={cell({ padding: '9px 4px' })}>&nbsp;</td>
                  <td style={cell({ padding: '9px 4px' })}>&nbsp;</td>
                  <td style={cell({ padding: '9px 4px' })}>&nbsp;</td>
                </>
              )}
            </tr>
          ))}
        </tbody>

        <tfoot>
          <tr>
            <td colSpan={showReturns ? 5 : 4} style={cell({ textAlign: 'right', fontWeight: 'bold', background: '#f0f7f0', fontSize: 11, color: '#333' })}>
              TOTAL DU MOIS
            </td>
            {showReturns && <td style={cell({ background: '#f0f7f0' })}>&nbsp;</td>}
            <td style={cell({ textAlign: 'center', fontWeight: 'bold', background: '#f0f7f0', fontSize: 13, color: GREEN })}>
              {grand_total}
            </td>
            {showPricing && (
              <>
                <td style={cell({ background: '#f0f7f0' })}>&nbsp;</td>
                <td style={cell({ textAlign: 'right', fontWeight: 'bold', background: '#f0f7f0', fontSize: 11 })}>
                  {grandTotalHt.toFixed(2)} €
                </td>
                <td style={cell({ background: '#f0f7f0' })}>&nbsp;</td>
                <td style={cell({ textAlign: 'right', fontWeight: 'bold', background: '#f0f7f0', fontSize: 12, color: GREEN })}>
                  {grandTotalTtc.toFixed(2)} €
                </td>
              </>
            )}
          </tr>
        </tfoot>
      </table>

      {showPricing && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 11 }}>
            <tbody>
              <tr>
                <td style={cell({ textAlign: 'right', fontWeight: 'bold', background: '#f5f5f5', padding: '4px 10px' })}>Total HT</td>
                <td style={cell({ textAlign: 'right', padding: '4px 10px', minWidth: 90 })}>{grandTotalHt.toFixed(2)} €</td>
              </tr>
              <tr>
                <td style={cell({ textAlign: 'right', fontWeight: 'bold', background: '#f5f5f5', padding: '4px 10px' })}>Total TVA</td>
                <td style={cell({ textAlign: 'right', padding: '4px 10px', minWidth: 90 })}>{(grandTotalTtc - grandTotalHt).toFixed(2)} €</td>
              </tr>
              <tr>
                <td style={cell({ textAlign: 'right', fontWeight: 'bold', background: '#f0f7f0', padding: '4px 10px', color: GREEN })}>Total TTC</td>
                <td style={cell({ textAlign: 'right', fontWeight: 'bold', padding: '4px 10px', minWidth: 90, color: GREEN })}>{grandTotalTtc.toFixed(2)} €</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: 10, marginTop: 8 }}>
        <div>
          Fait à <span style={{ display: 'inline-block', width: 100, borderBottom: '1px solid #000' }}>&nbsp;</span>
          &nbsp; le <span style={{ display: 'inline-block', width: 80, borderBottom: '1px solid #000' }}>&nbsp;</span>
        </div>
        <div>
          <div style={{ fontSize: 9, color: '#777', marginBottom: 4 }}>Cachet et signature du destinataire :</div>
          <div style={{ border: '1px solid #bbb', width: 160, height: 40 }}>&nbsp;</div>
        </div>
      </div>

      <div style={{ marginTop: 6, fontSize: 9, color: '#777', textAlign: 'center' }}>
        Nous nous réservons la propriété des marchandises jusqu'au paiement intégral de notre facture.
      </div>
    </div>
  );
});

DeliverySlip.displayName = 'DeliverySlip';
export default DeliverySlip;
