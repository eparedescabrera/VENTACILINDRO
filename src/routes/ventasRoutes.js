const express = require('express');
const {
  listarVentas,
  obtenerVenta,
  crearVenta,
  actualizarVenta,
  marcarComoPagada,
  anularVenta,
  obtenerComprobante,
} = require('../controllers/ventasController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');
const upload = require('../middlewares/upload');
const { validarVenta } = require('../validators/ventaValidator');

const router = express.Router();

router.use(verificarToken);

router.get('/', listarVentas);
router.get('/:id', obtenerVenta);
router.get('/:id/comprobante', obtenerComprobante);
router.post('/', upload.single('comprobante'), validarVenta, crearVenta);
router.put('/:id', upload.single('comprobante'), validarVenta, actualizarVenta);
router.patch('/:id/pagar', permitirRoles('Administrador'), marcarComoPagada);
router.patch('/:id/anular', permitirRoles('Administrador'), anularVenta);

module.exports = router;
