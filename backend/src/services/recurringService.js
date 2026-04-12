const db = require('../config/database');

/**
 * Pour chaque règle récurrente active de l'utilisateur,
 * crée une livraison pour le jour du mois correspondant
 * si elle n'existe pas déjà. Génère sur tout le mois.
 * Retourne le nombre de livraisons créées.
 */
async function generateRecurringForMonth(userId, month, year) {
  const daysInMonth = new Date(year, month, 0).getDate();

  const { rows: rules } = await db.query(
    `SELECT * FROM recurring_deliveries
     WHERE user_id = $1 AND is_active = TRUE
     ORDER BY store_id, day_of_month`,
    [userId]
  );

  let created = 0;
  for (const rule of rules) {
    if (rule.day_of_month > daysInMonth) continue; // ex: jour 31 en février

    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(rule.day_of_month).padStart(2, '0')}`;

    // Ne pas créer si une livraison existe déjà ce jour pour ce magasin
    const { rows: existing } = await db.query(
      `SELECT id FROM deliveries WHERE store_id = $1 AND delivery_date = $2 LIMIT 1`,
      [rule.store_id, dateStr]
    );
    if (existing.length > 0) continue;

    // Prochain numéro de livraison pour ce magasin
    const { rows: [numRow] } = await db.query(
      `SELECT COALESCE(MAX(delivery_number), 0) + 1 AS next_num
       FROM deliveries WHERE store_id = $1`,
      [rule.store_id]
    );

    await db.query(
      `INSERT INTO deliveries
         (user_id, store_id, delivery_date, delivery_number, quantity_delivered, is_recurring)
       VALUES ($1, $2, $3, $4, $5, TRUE)`,
      [userId, rule.store_id, dateStr, numRow.next_num, rule.quantity]
    );
    created++;
  }
  return created;
}

module.exports = { generateRecurringForMonth };
