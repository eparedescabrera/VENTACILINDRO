const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

const listarUsuarios = asyncHandler(async (req, res) => {
  const [filas] = await pool.query(
    `SELECT u.id_usuario, u.nombre_completo, u.nombre_usuario, u.correo, u.estado,
            u.fecha_creacion, r.id_rol, r.nombre AS rol
     FROM usuarios u
     INNER JOIN roles r ON r.id_rol = u.id_rol
     ORDER BY u.nombre_completo`
  );
  res.json(filas);
});

const listarRoles = asyncHandler(async (req, res) => {
  const [filas] = await pool.query('SELECT * FROM roles WHERE estado = 1 ORDER BY nombre');
  res.json(filas);
});

const crearUsuario = asyncHandler(async (req, res) => {
  const { nombre_completo, nombre_usuario, correo, password, id_rol } = req.body;

  if (!nombre_completo || !nombre_usuario || !password || !id_rol) {
    return res.status(400).json({ mensaje: 'Nombre completo, usuario, contraseña y rol son obligatorios.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ mensaje: 'La contraseña debe tener al menos 6 caracteres.' });
  }

  const [existente] = await pool.query('SELECT id_usuario FROM usuarios WHERE nombre_usuario = ?', [nombre_usuario]);
  if (existente.length > 0) {
    return res.status(409).json({ mensaje: 'Ya existe un usuario con ese nombre de usuario.' });
  }

  const hash = await bcrypt.hash(password, 10);

  const [resultado] = await pool.query(
    `INSERT INTO usuarios (nombre_completo, nombre_usuario, correo, password_hash, id_rol)
     VALUES (?, ?, ?, ?, ?)`,
    [nombre_completo.trim(), nombre_usuario.trim(), correo || null, hash, id_rol]
  );

  res.status(201).json({ mensaje: 'Usuario creado correctamente.', id_usuario: resultado.insertId });
});

const actualizarUsuario = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { nombre_completo, correo, id_rol, estado, password } = req.body;

  const [filas] = await pool.query('SELECT * FROM usuarios WHERE id_usuario = ?', [id]);
  if (filas.length === 0) {
    return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
  }

  const usuario = filas[0];
  let hash = usuario.password_hash;
  if (password) {
    if (password.length < 6) {
      return res.status(400).json({ mensaje: 'La contraseña debe tener al menos 6 caracteres.' });
    }
    hash = await bcrypt.hash(password, 10);
  }

  await pool.query(
    `UPDATE usuarios SET nombre_completo = ?, correo = ?, id_rol = ?, estado = ?, password_hash = ?
     WHERE id_usuario = ?`,
    [
      nombre_completo || usuario.nombre_completo,
      correo ?? usuario.correo,
      id_rol || usuario.id_rol,
      estado === undefined ? usuario.estado : estado,
      hash,
      id,
    ]
  );

  res.json({ mensaje: 'Usuario actualizado correctamente.' });
});

module.exports = { listarUsuarios, listarRoles, crearUsuario, actualizarUsuario };
