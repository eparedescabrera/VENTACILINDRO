const express = require('express');
const {
  obtenerConfiguracion,
  actualizarConfiguracion,
  subirLogo,
  eliminarLogo,
} = require('../controllers/configuracionController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');
const upload = require('../middlewares/upload');

const router = express.Router();

// La configuración es pública para poder mostrar el logo en el login.
router.get('/', obtenerConfiguracion);

router.use(verificarToken);
router.put('/', permitirRoles('Administrador'), actualizarConfiguracion);
router.post('/logo', permitirRoles('Administrador'), upload.single('logo'), subirLogo);
router.delete('/logo', permitirRoles('Administrador'), eliminarLogo);

module.exports = router;
