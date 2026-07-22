const express = require('express');
const { login, perfil } = require('../controllers/authController');
const { verificarToken } = require('../middlewares/auth');

const router = express.Router();

router.post('/login', login);
router.get('/perfil', verificarToken, perfil);

module.exports = router;
