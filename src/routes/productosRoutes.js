const express = require('express');
const { listarProductos, actualizarProducto } = require('../controllers/productosController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');

const router = express.Router();

router.use(verificarToken);
router.get('/', listarProductos);
router.put('/:id', permitirRoles('Administrador'), actualizarProducto);

module.exports = router;
