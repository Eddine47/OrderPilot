const express = require('express');
const { body } = require('express-validator');
const {
  listDeliveries, getDelivery, createDelivery, updateDelivery,
  patchStatus, deleteDelivery, todayDeliveries, monthlyTotal, upcomingDeliveries,
} = require('../controllers/deliveryController');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

router.get('/today',         todayDeliveries);
router.get('/monthly-total', monthlyTotal);
router.get('/upcoming',      upcomingDeliveries);

router.get('/',    listDeliveries);
router.post('/',
  body('store_id').isInt({ gt: 0 }).withMessage('Enseigne invalide'),
  body('delivery_date').isDate().withMessage('Date invalide'),
  body('order_reference').optional().isString().trim(),
  body('items').isArray({ min: 1 }).withMessage('Au moins une ligne produit'),
  body('items.*.quantity_delivered').isInt({ min: 0 }).withMessage('Quantité livrée invalide'),
  body('items.*.quantity_recovered').optional().isInt({ min: 0 }),
  body('items.*.product_id').optional({ nullable: true }).isInt({ gt: 0 }),
  body('items.*.unit_price_ht').optional({ nullable: true }).isFloat({ min: 0 }),
  body('items.*.vat_rate').optional({ nullable: true }).isFloat({ min: 0, max: 100 }),
  createDelivery
);

router.get('/:id',           getDelivery);
router.put('/:id',
  body('delivery_date').optional().isDate(),
  body('status').optional().isIn(['pending', 'ok']),
  body('order_reference').optional().isString().trim(),
  body('items').optional().isArray({ min: 1 }),
  body('items.*.quantity_delivered').optional().isInt({ min: 0 }),
  body('items.*.quantity_recovered').optional().isInt({ min: 0 }),
  body('items.*.product_id').optional({ nullable: true }).isInt({ gt: 0 }),
  body('items.*.unit_price_ht').optional({ nullable: true }).isFloat({ min: 0 }),
  body('items.*.vat_rate').optional({ nullable: true }).isFloat({ min: 0, max: 100 }),
  updateDelivery
);
router.patch('/:id/status',  patchStatus);
router.delete('/:id',        deleteDelivery);

module.exports = router;
