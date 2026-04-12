const app  = require('./app');
const cron = require('node-cron');
const { generateRecurringForToday } = require('./services/recurringService');

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

// Every day at 00:05 generate recurring deliveries
cron.schedule('5 0 * * *', async () => {
  console.log('[cron] Generating recurring deliveries for today…');
  try {
    const created = await generateRecurringForToday();
    console.log(`[cron] ${created} delivery(ies) created.`);
  } catch (err) {
    console.error('[cron] Error:', err.message);
  }
});
