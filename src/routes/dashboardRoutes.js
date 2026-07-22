const express = require('express');
const { resumen, ultimasVentas, ultimosGastos } = require('../controllers/dashboardController');
const { verificarToken } = require('../middlewares/auth');

const router = express.Router();

router.use(verificarToken);

router.get('/resumen', resumen);
router.get('/ultimas-ventas', ultimasVentas);
router.get('/ultimos-gastos', ultimosGastos);

module.exports = router;
