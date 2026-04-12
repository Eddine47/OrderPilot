const express = require('express');
const { body } = require('express-validator');
const {
  listRules, createRule, updateRule, deleteRule, generate,
} = require('../controllers/recurringController');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

router.get('/',     listRules);
router.post('/',
  body('store_id').isInt({ gt: 0 }),
  body('day_of_month').isInt({ min: 1, max: 31 }),
  body('quantity').isInt({ min: 1 }),
  createRule
);
router.put('/:id',
  body('day_of_month').optional().isInt({ min: 1, max: 31 }),
  body('quantity').optional().isInt({ min: 1 }),
  body('is_active').optional().isBoolean(),
  updateRule
);
router.delete('/:id', deleteRule);
router.post('/generate', generate);

module.exports = router;
