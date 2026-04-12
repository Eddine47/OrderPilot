const express = require('express');
const { body } = require('express-validator');
const {
  listDeliveries, getDelivery, createDelivery, updateDelivery,
  patchStatus, deleteDelivery, todayDeliveries, monthlyTotal,
} = require('../controllers/deliveryController');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

router.get('/today',         todayDeliveries);
router.get('/monthly-total', monthlyTotal);

router.get('/',    listDeliveries);
router.post('/',
  body('store_id').isInt({ gt: 0 }).withMessage('Enseigne invalide'),
  body('delivery_date').isDate().withMessage('Date invalide'),
  body('quantity_delivered').isInt({ min: 0 }).withMessage('Quantité livrée invalide'),
  body('quantity_recovered').optional().isInt({ min: 0 }),
  createDelivery
);

router.get('/:id',           getDelivery);
router.put('/:id',
  body('delivery_date').optional().isDate(),
  body('quantity_delivered').optional().isInt({ min: 0 }),
  body('quantity_recovered').optional().isInt({ min: 0 }),
  body('status').optional().isIn(['pending', 'ok']),
  updateDelivery
);
router.patch('/:id/status',  patchStatus);
router.delete('/:id',        deleteDelivery);

module.exports = router;
