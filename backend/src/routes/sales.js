const express = require('express');
const { body } = require('express-validator');
const { listSales, createSale, updateSale, deleteSale } = require('../controllers/salesController');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();
router.use(verifyToken);

router.get('/', listSales);

router.post('/',
  body('sale_date').isDate().withMessage('Date invalide'),
  body('quantity').isInt({ min: 0 }).withMessage('Quantité invalide'),
  body('payment_method').isIn(['card', 'cash']).withMessage('Moyen de paiement invalide'),
  body('notes').optional().isString().trim(),
  createSale
);

router.put('/:id',
  body('sale_date').optional().isDate(),
  body('quantity').optional().isInt({ min: 0 }),
  body('payment_method').optional().isIn(['card', 'cash']),
  body('notes').optional().isString().trim(),
  updateSale
);

router.delete('/:id', deleteSale);

module.exports = router;
