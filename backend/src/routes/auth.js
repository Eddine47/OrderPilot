const express = require('express');
const { body } = require('express-validator');
const { register, login, me, updateProfile } = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.post('/register',
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Mot de passe : 8 caractères minimum'),
  body('name').trim().notEmpty().withMessage('Nom requis'),
  register
);

router.post('/login',
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  login
);

router.get('/me', verifyToken, me);

router.put('/me',
  verifyToken,
  body('name').optional().trim().notEmpty(),
  body('company_name').optional().trim().notEmpty(),
  body('email').optional().isEmail().normalizeEmail(),
  body('new_password').optional().isLength({ min: 8 }).withMessage('Nouveau mot de passe : 8 caractères minimum'),
  updateProfile
);

module.exports = router;
