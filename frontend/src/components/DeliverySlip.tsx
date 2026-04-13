import { forwardRef } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { MonthlySlip } from '../types';
import { MONTH_NAMES } from '../types';

interface Props { slip: MonthlySlip; }

// Tous les styles sont inline — Tailwind n'est pas disponible dans l'iframe react-to-print
const DeliverySlip = forwardRef<HTMLDivElement, Props>(({ slip }, ref) => {
  const { store, user, month, year, slip_number, deliveries, grand_total } = slip;
  const showReturns = store.has_returns ?? false;

  const GREEN = '#1a6b3c';

  const cell = (extra?: React.CSSProperties): React.CSSProperties => ({
    border: '1px solid #bbb',
    padding: '4px 6px',
    fontSize: 10,
    ...extra,
  });

  // Lignes vides pour compléter jusqu'à 15 lignes minimum
  const MIN_ROWS = 15;
  const padCount = Math.max(0, MIN_ROWS - deliveries.length);

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

      {/* ── EN-TÊTE ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>

        {/* Gauche : DATE + EXPÉDITEUR */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase', color: '#555', border: '1px solid #bbb', padding: '2px 6px' }}>PÉRIODE</span>
            <span style={{ fontSize: 13, fontWeight: 'bold' }}>{MONTH_NAMES[month - 1]} {year}</span>
          </div>
          <div style={{ fontSize: 8, fontWeight: 'bold', textTransform: 'uppercase', color: '#555', marginBottom: 3 }}>EXPÉDITEUR</div>
          <div style={{ border: '1px solid #bbb', padding: '6px 8px', minHeight: 60 }}>
            <div style={{ fontWeight: 'bold', fontSize: 12 }}>{user.company_name}</div>
            {user.company_address && (
              <div style={{ fontSize: 10, marginTop: 2, whiteSpace: 'pre-line' }}>{user.company_address}</div>
            )}
            {user.company_siret && (
              <div style={{ fontSize: 10, marginTop: 2 }}>Siret : {user.company_siret}</div>
            )}
          </div>
        </div>

        {/* Droite : N° BON + DESTINATAIRE */}
        <div style={{ flex: 1, textAlign: 'right', paddingLeft: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0, marginBottom: 6 }}>
            <div style={{
              background: GREEN,
              color: '#fff',
              fontWeight: 'bold',
              fontSize: 11,
              padding: '4px 10px',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}>
              BON DE LIVRAISON N°
            </div>
            <div style={{
              border: `2px solid ${GREEN}`,
              fontSize: 18,
              fontWeight: 'bold',
              padding: '2px 14px',
              minWidth: 44,
              textAlign: 'center',
              color: GREEN,
            }}>
              {slip_number}
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

      {/* ── RÉFÉRENCES ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 0, borderBottom: '1px solid #ccc', paddingBottom: 4, marginBottom: 4, fontSize: 10 }}>
        <div>Conditions de paiement : <span style={{ display: 'inline-block', width: 100, borderBottom: '1px solid #000' }}>&nbsp;</span></div>
        <div>Emballage : <span style={{ display: 'inline-block', width: 40, borderBottom: '1px solid #000' }}>&nbsp;</span></div>
        <div>Port : <span style={{ display: 'inline-block', width: 40, borderBottom: '1px solid #000' }}>&nbsp;</span></div>
      </div>

      {/* ── TABLEAU DES LIVRAISONS ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
        <thead>
          <tr>
            <th style={cell({ textAlign: 'center', width: 32, fontWeight: 'bold', background: '#e8e8e8' })}>N°</th>
            <th style={cell({ textAlign: 'center', width: 72, fontWeight: 'bold', background: '#e8e8e8' })}>Réf. cmd</th>
            <th style={cell({ textAlign: 'center', width: 60, fontWeight: 'bold', background: '#e8e8e8' })}>Date</th>
            <th style={cell({ textAlign: 'left', fontWeight: 'bold', background: '#e8e8e8' })}>Description</th>
            {showReturns && <th style={cell({ textAlign: 'center', width: 60, fontWeight: 'bold', background: '#e8e8e8' })}>Retourné</th>}
            <th style={cell({ textAlign: 'center', width: 44, fontWeight: 'bold', background: '#e8e8e8' })}>Qté totale</th>
          </tr>
        </thead>
        <tbody>
          {deliveries.map((d, idx) => {
            const retourne = d.quantity_recovered ?? 0;
            const total    = (d.quantity_delivered ?? 0) - retourne;
            return (
              <tr key={d.id}>
                <td style={cell({ textAlign: 'center', padding: '4px 4px', fontWeight: 'bold', color: GREEN })}>{idx + 1}</td>
                <td style={cell({ textAlign: 'center', padding: '4px 4px', fontSize: 9 })}>
                  {d.order_reference || '—'}
                </td>
                <td style={cell({ textAlign: 'center', padding: '4px 4px' })}>
                  {format(new Date(d.delivery_date.slice(0, 10) + 'T12:00:00'), 'dd/MM/yy', { locale: fr })}
                </td>
                <td style={cell({ padding: '4px 6px' })}>
                  {d.quantity_delivered} paquet{d.quantity_delivered > 1 ? 's' : ''}
                  {showReturns && retourne > 0 && (
                    <span style={{ marginLeft: 6, color: '#c05600', fontSize: 9 }}>
                      (dont {retourne} retourné{retourne > 1 ? 's' : ''})
                    </span>
                  )}
                </td>
                {showReturns && (
                  <td style={cell({ textAlign: 'center', padding: '4px 4px', color: retourne > 0 ? '#c05600' : '#999' })}>
                    {retourne > 0 ? retourne : '—'}
                  </td>
                )}
                <td style={cell({ textAlign: 'center', padding: '4px 4px', fontWeight: 'bold', color: GREEN })}>
                  {total}
                </td>
              </tr>
            );
          })}

          {/* Lignes vides */}
          {Array.from({ length: padCount }).map((_, i) => (
            <tr key={`pad-${i}`}>
              <td style={cell({ padding: '9px 4px' })}>&nbsp;</td>
              <td style={cell({ padding: '9px 4px' })}>&nbsp;</td>
              <td style={cell({ padding: '9px 4px' })}>&nbsp;</td>
              <td style={cell({ padding: '9px 6px' })}>&nbsp;</td>
              {showReturns && <td style={cell({ padding: '9px 4px' })}>&nbsp;</td>}
              <td style={cell({ padding: '9px 4px' })}>&nbsp;</td>
            </tr>
          ))}
        </tbody>

        {/* Total général */}
        <tfoot>
          <tr>
            <td colSpan={4} style={cell({ textAlign: 'right', fontWeight: 'bold', background: '#f0f7f0', fontSize: 11, color: '#333' })}>
              TOTAL DU MOIS
            </td>
            {showReturns && <td style={cell({ background: '#f0f7f0' })}>&nbsp;</td>}
            <td style={cell({ textAlign: 'center', fontWeight: 'bold', background: '#f0f7f0', fontSize: 13, color: GREEN })}>
              {grand_total}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* ── PIED DE PAGE ── */}
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
