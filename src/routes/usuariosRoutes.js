const express = require('express');
const { listarUsuarios, listarRoles, crearUsuario, actualizarUsuario } = require('../controllers/usuariosController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');

const router = express.Router();

router.use(verificarToken, permitirRoles('Administrador'));

router.get('/', listarUsuarios);
router.get('/roles', listarRoles);
router.post('/', crearUsuario);
router.put('/:id', actualizarUsuario);

module.exports = router;
