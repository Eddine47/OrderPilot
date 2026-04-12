import { forwardRef } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { MonthlySlip } from '../types';
import { MONTH_NAMES } from '../types';

interface Props { slip: MonthlySlip; }

// Tous les styles sont inline — Tailwind n'est pas disponible dans l'iframe react-to-print
const DeliverySlip = forwardRef<HTMLDivElement, Props>(({ slip }, ref) => {
  const { store, user, month, year, slip_number, deliveries, grand_total } = slip;

  const GREEN = '#1a6b3c';

  const cell = (extra?: React.CSSProperties): React.CSSProperties => ({
    border: '1px solid #bbb',
    padding: '4px 6px',
    fontSize: 11,
    ...extra,
  });

  // Lignes vides pour compléter jusqu'à 20 lignes minimum
  const MIN_ROWS = 20;
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
            <span style={{ fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase', color: '#555', border: '1px solid #bbb', padding: '2px 6px' }}>DATE</span>
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

        {/* Droite : N° + DESTINATAIRE */}
        <div style={{ flex: 1, textAlign: 'right', paddingLeft: 16 }}>
          {/* "BON DE LIVRAISON N°" en vert + numéro */}
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
              LIVRAISON N°
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
        <div>Réf. commande : <span style={{ display: 'inline-block', width: 80, borderBottom: '1px solid #000' }}>&nbsp;</span></div>
        <div>Emballage : <span style={{ display: 'inline-block', width: 40, borderBottom: '1px solid #000' }}>&nbsp;</span></div>
        <div>Port : <span style={{ display: 'inline-block', width: 40, borderBottom: '1px solid #000' }}>&nbsp;</span></div>
      </div>
      <div style={{ fontSize: 10, borderBottom: '1px solid #ccc', paddingBottom: 4, marginBottom: 8 }}>
        Conditions de paiement : <span style={{ display: 'inline-block', width: 200, borderBottom: '1px solid #000' }}>&nbsp;</span>
      </div>

      {/* ── TABLEAU ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
        <thead>
          <tr>
            <th style={cell({ textAlign: 'center', width: 68, fontWeight: 'bold', background: '#e8e8e8' })}>Date</th>
            <th style={cell({ textAlign: 'left', fontWeight: 'bold', background: '#e8e8e8' })}>Description</th>
            <th style={cell({ textAlign: 'center', width: 80, fontWeight: 'bold', background: '#e8e8e8' })}>Produit retourné</th>
            <th style={cell({ textAlign: 'center', width: 44, fontWeight: 'bold', background: '#e8e8e8' })}>Qté</th>
            <th style={cell({ textAlign: 'center', width: 80, fontWeight: 'bold', background: '#e8e8e8' })}>Signature</th>
          </tr>
        </thead>
        <tbody>
          {deliveries.map((d) => (
            <tr key={d.id}>
              <td style={cell({ textAlign: 'center', padding: '3px 6px' })}>
                {format(new Date(d.delivery_date.slice(0, 10) + 'T12:00:00'), 'dd/MM/yy', { locale: fr })}
              </td>
              <td style={cell({ padding: '3px 6px' })}>
                {d.quantity_delivered} paquets
              </td>
              <td style={cell({ padding: '3px 6px' })}>&nbsp;</td>
              <td style={cell({ padding: '3px 6px' })}>&nbsp;</td>
              <td style={cell({ padding: '3px 6px' })}>&nbsp;</td>
            </tr>
          ))}

          {/* Lignes vides */}
          {Array.from({ length: padCount }).map((_, i) => (
            <tr key={`pad-${i}`}>
              <td style={cell({ padding: '9px 6px' })}>&nbsp;</td>
              <td style={cell({ padding: '9px 6px' })}>&nbsp;</td>
              <td style={cell({ padding: '9px 6px' })}>&nbsp;</td>
              <td style={cell({ padding: '9px 6px' })}>&nbsp;</td>
              <td style={cell({ padding: '9px 6px' })}>&nbsp;</td>
            </tr>
          ))}
        </tbody>

        {/* Total */}
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

      {/* ── PIED DE PAGE ── */}
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
});

DeliverySlip.displayName = 'DeliverySlip';
export default DeliverySlip;
