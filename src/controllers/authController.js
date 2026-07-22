const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

const login = asyncHandler(async (req, res) => {
  const { nombre_usuario, password } = req.body;

  if (!nombre_usuario || !password) {
    return res.status(400).json({ mensaje: 'Debe indicar usuario y contraseña.' });
  }

  const [filas] = await pool.query(
    `SELECT u.id_usuario, u.nombre_completo, u.nombre_usuario, u.correo, u.password_hash,
            u.estado, r.nombre AS rol
     FROM usuarios u
     INNER JOIN roles r ON r.id_rol = u.id_rol
     WHERE u.nombre_usuario = ?`,
    [nombre_usuario]
  );

  if (filas.length === 0) {
    return res.status(401).json({ mensaje: 'Usuario o contraseña incorrectos.' });
  }

  const usuario = filas[0];

  if (!usuario.estado) {
    return res.status(403).json({ mensaje: 'El usuario se encuentra inactivo. Contacte al administrador.' });
  }

  const contrasenaValida = await bcrypt.compare(password, usuario.password_hash);
  if (!contrasenaValida) {
    return res.status(401).json({ mensaje: 'Usuario o contraseña incorrectos.' });
  }

  const token = jwt.sign(
    { id_usuario: usuario.id_usuario, nombre_usuario: usuario.nombre_usuario, rol: usuario.rol },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  res.json({
    token,
    usuario: {
      id_usuario: usuario.id_usuario,
      nombre_completo: usuario.nombre_completo,
      nombre_usuario: usuario.nombre_usuario,
      correo: usuario.correo,
      rol: usuario.rol,
    },
  });
});

const perfil = asyncHandler(async (req, res) => {
  const [filas] = await pool.query(
    `SELECT u.id_usuario, u.nombre_completo, u.nombre_usuario, u.correo, u.estado,
            r.nombre AS rol
     FROM usuarios u
     INNER JOIN roles r ON r.id_rol = u.id_rol
     WHERE u.id_usuario = ?`,
    [req.usuario.id_usuario]
  );

  if (filas.length === 0) {
    return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
  }

  res.json(filas[0]);
});

module.exports = { login, perfil };
