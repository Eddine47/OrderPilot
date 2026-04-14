const express = require('express');
const { body } = require('express-validator');
const { listSales, createSale, updateSale, deleteSale } = require('../controllers/salesController');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();
router.use(verifyToken);

router.get('/', listSales);

router.post('/',
  body('sale_date').isDate().withMessage('Date invalide'),
  body('payment_method').isIn(['card', 'cash']).withMessage('Moyen de paiement invalide'),
  body('notes').optional().isString().trim(),
  body('items').isArray({ min: 1 }).withMessage('Au moins une ligne produit'),
  body('items.*.quantity').isInt({ min: 0 }).withMessage('Quantité invalide'),
  body('items.*.product_id').optional({ nullable: true }).isInt({ gt: 0 }),
  body('items.*.unit_price_ht').optional({ nullable: true }).isFloat({ min: 0 }),
  body('items.*.vat_rate').optional({ nullable: true }).isFloat({ min: 0, max: 100 }),
  createSale
);

router.put('/:id',
  body('sale_date').optional().isDate(),
  body('payment_method').optional().isIn(['card', 'cash']),
  body('notes').optional().isString().trim(),
  body('items').optional().isArray({ min: 1 }),
  body('items.*.quantity').optional().isInt({ min: 0 }),
  body('items.*.product_id').optional({ nullable: true }).isInt({ gt: 0 }),
  body('items.*.unit_price_ht').optional({ nullable: true }).isFloat({ min: 0 }),
  body('items.*.vat_rate').optional({ nullable: true }).isFloat({ min: 0, max: 100 }),
  updateSale
);

router.delete('/:id', deleteSale);

module.exports = router;
