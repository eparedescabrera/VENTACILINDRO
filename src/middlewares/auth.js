const jwt = require('jsonwebtoken');
require('dotenv').config();

/**
 * Verifica el token JWT enviado en el header Authorization: Bearer <token>
 */
function verificarToken(req, res, next) {
  const encabezado = req.headers.authorization || '';
  const token = encabezado.startsWith('Bearer ') ? encabezado.slice(7) : null;

  if (!token) {
    return res.status(401).json({ mensaje: 'No se proporcionó un token de acceso.' });
  }

  try {
    const decodificado = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = decodificado;
    next();
  } catch (error) {
    return res.status(401).json({ mensaje: 'Token inválido o expirado.' });
  }
}

/**
 * Restringe el acceso a los roles indicados.
 * @param  {...string} rolesPermitidos
 */
function permitirRoles(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ mensaje: 'No tiene permisos para realizar esta acción.' });
    }
    next();
  };
}

module.exports = { verificarToken, permitirRoles };
