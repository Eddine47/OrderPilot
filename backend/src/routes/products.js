const express = require('express');
const { body } = require('express-validator');
const {
  listProducts, getProduct, createProduct, updateProduct, deleteProduct,
} = require('../controllers/productController');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

router.get('/', listProducts);
router.post('/',
  body('name').trim().notEmpty().withMessage('Nom requis'),
  body('unit').optional().trim(),
  body('unit_price_ht').optional().isFloat({ min: 0 }).withMessage('Prix unitaire invalide'),
  body('vat_rate').optional().isFloat({ min: 0, max: 100 }).withMessage('Taux TVA invalide'),
  createProduct
);

router.get('/:id', getProduct);
router.put('/:id',
  body('name').optional().trim().notEmpty(),
  body('unit').optional().trim(),
  body('unit_price_ht').optional().isFloat({ min: 0 }),
  body('vat_rate').optional().isFloat({ min: 0, max: 100 }),
  updateProduct
);
router.delete('/:id', deleteProduct);

module.exports = router;
