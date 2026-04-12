const express = require('express');
const { body } = require('express-validator');
const {
  listStores, getStore, createStore, updateStore, deleteStore,
  getMonthlySlip, getMonthlySummary,
} = require('../controllers/storeController');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

router.get('/',    listStores);
router.post('/',
  body('name').trim().notEmpty().withMessage('Nom de l\'enseigne requis'),
  createStore
);

router.get('/summary', getMonthlySummary);

router.get('/:id',         getStore);
router.put('/:id',
  body('name').optional().trim().notEmpty(),
  updateStore
);
router.delete('/:id',      deleteStore);
router.get('/:id/slip',    getMonthlySlip);

module.exports = router;
