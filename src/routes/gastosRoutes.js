const express = require('express');
const {
  listarGastos,
  obtenerGasto,
  crearGasto,
  actualizarGasto,
  eliminarGasto,
  obtenerComprobante,
  listarCategorias,
} = require('../controllers/gastosController');
const { verificarToken } = require('../middlewares/auth');
const upload = require('../middlewares/upload');
const { validarGasto } = require('../validators/gastoValidator');

const router = express.Router();

router.use(verificarToken);

router.get('/categorias', listarCategorias);
router.get('/', listarGastos);
router.get('/:id', obtenerGasto);
router.get('/:id/comprobante', obtenerComprobante);
router.post('/', upload.single('comprobante'), validarGasto, crearGasto);
router.put('/:id', upload.single('comprobante'), validarGasto, actualizarGasto);
router.delete('/:id', eliminarGasto);

module.exports = router;
