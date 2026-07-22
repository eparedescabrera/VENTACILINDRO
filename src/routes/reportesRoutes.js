const express = require('express');
const { reporteVentas, reporteGastos, reporteResumen } = require('../controllers/reportesController');
const { verificarToken } = require('../middlewares/auth');

const router = express.Router();

router.use(verificarToken);

router.get('/ventas', reporteVentas);
router.get('/gastos', reporteGastos);
router.get('/resumen', reporteResumen);

module.exports = router;
