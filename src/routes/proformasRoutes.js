const express = require('express');
const {
  listarProformas,
  obtenerProforma,
  crearProforma,
  anularProforma,
} = require('../controllers/proformasController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');

const router = express.Router();

router.use(verificarToken);
router.get('/', listarProformas);
router.get('/:id', obtenerProforma);
router.post('/', permitirRoles('Administrador', 'Vendedor'), crearProforma);
router.patch('/:id/anular', permitirRoles('Administrador', 'Vendedor'), anularProforma);

module.exports = router;
