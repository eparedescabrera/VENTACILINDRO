const express = require('express');
const {
  listarClientes,
  listarClientesActivos,
  obtenerCliente,
  crearCliente,
  actualizarCliente,
  eliminarCliente,
} = require('../controllers/clientesController');
const { verificarToken } = require('../middlewares/auth');

const router = express.Router();

router.use(verificarToken);

router.get('/', listarClientes);
router.get('/activos', listarClientesActivos);
router.get('/:id', obtenerCliente);
router.post('/', crearCliente);
router.put('/:id', actualizarCliente);
router.delete('/:id', eliminarCliente);

module.exports = router;
