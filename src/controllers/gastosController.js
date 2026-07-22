const { pool } = require('../config/db');
const { validationResult } = require('express-validator');
const asyncHandler = require('../utils/asyncHandler');
const { subirImagen, eliminarImagen, eliminarArchivoTemporal } = require('../utils/cloudinaryHelper');

function esAdministrador(req) {
  return req.usuario?.rol === 'Administrador';
}

const listarGastos = asyncHandler(async (req, res) => {
  const {
    fecha_inicio,
    fecha_fin,
    id_categoria,
    metodo_pago,
    id_usuario,
    buscar,
    pagina = 1,
    limite = 10,
  } = req.query;

  const condiciones = ['g.activo = 1'];
  const parametros = [];

  if (fecha_inicio) {
    condiciones.push('g.fecha >= ?');
    parametros.push(`${fecha_inicio} 00:00:00`);
  }
  if (fecha_fin) {
    condiciones.push('g.fecha <= ?');
    parametros.push(`${fecha_fin} 23:59:59`);
  }
  if (id_categoria) {
    condiciones.push('g.id_categoria = ?');
    parametros.push(id_categoria);
  }
  if (metodo_pago) {
    condiciones.push('g.metodo_pago = ?');
    parametros.push(metodo_pago);
  }

  if (!esAdministrador(req)) {
    condiciones.push('g.id_usuario = ?');
    parametros.push(req.usuario.id_usuario);
  } else if (id_usuario) {
    condiciones.push('g.id_usuario = ?');
    parametros.push(id_usuario);
  }

  if (buscar) {
    condiciones.push('(g.descripcion LIKE ? OR g.numero_comprobante LIKE ?)');
    parametros.push(`%${buscar}%`, `%${buscar}%`);
  }

  const whereSql = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  const [totalFilas] = await pool.query(`SELECT COUNT(*) AS total FROM gastos g ${whereSql}`, parametros);
  const total = totalFilas[0].total;

  const paginaNum = Math.max(parseInt(pagina, 10) || 1, 1);
  const limiteNum = Math.max(parseInt(limite, 10) || 10, 1);
  const desplazamiento = (paginaNum - 1) * limiteNum;

  const [filas] = await pool.query(
    `SELECT g.*, c.nombre AS categoria_nombre, u.nombre_completo AS usuario_nombre
     FROM gastos g
     INNER JOIN categorias_gastos c ON c.id_categoria = g.id_categoria
     INNER JOIN usuarios u ON u.id_usuario = g.id_usuario
     ${whereSql}
     ORDER BY g.fecha DESC, g.id_gasto DESC
     LIMIT ? OFFSET ?`,
    [...parametros, limiteNum, desplazamiento]
  );

  res.json({
    datos: filas,
    total,
    pagina: paginaNum,
    limite: limiteNum,
    totalPaginas: Math.ceil(total / limiteNum) || 1,
  });
});

const obtenerGasto = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [filas] = await pool.query(
    `SELECT g.*, c.nombre AS categoria_nombre, u.nombre_completo AS usuario_nombre
     FROM gastos g
     INNER JOIN categorias_gastos c ON c.id_categoria = g.id_categoria
     INNER JOIN usuarios u ON u.id_usuario = g.id_usuario
     WHERE g.id_gasto = ? AND g.activo = 1`,
    [id]
  );

  if (filas.length === 0) {
    return res.status(404).json({ mensaje: 'Gasto no encontrado.' });
  }

  const gasto = filas[0];
  if (!esAdministrador(req) && gasto.id_usuario !== req.usuario.id_usuario) {
    return res.status(403).json({ mensaje: 'No tiene permisos para consultar este gasto.' });
  }

  res.json(gasto);
});

const crearGasto = asyncHandler(async (req, res) => {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    if (req.file) eliminarArchivoTemporal(req.file.path);
    return res.status(400).json({ mensaje: 'Datos inválidos.', errores: errores.array() });
  }

  const { fecha, id_categoria, descripcion, monto, metodo_pago, numero_comprobante, observacion } = req.body;
  const montoNum = Number(monto);

  if (!descripcion || descripcion.trim() === '') {
    if (req.file) eliminarArchivoTemporal(req.file.path);
    return res.status(400).json({ mensaje: 'La descripción es obligatoria.' });
  }
  if (!id_categoria) {
    if (req.file) eliminarArchivoTemporal(req.file.path);
    return res.status(400).json({ mensaje: 'La categoría es obligatoria.' });
  }
  if (!(montoNum > 0)) {
    if (req.file) eliminarArchivoTemporal(req.file.path);
    return res.status(400).json({ mensaje: 'El monto debe ser mayor que cero.' });
  }

  let comprobanteUrl = null;
  let comprobantePublicId = null;

  try {
    if (req.file) {
      const subida = await subirImagen(req.file.path, 'sistema-cilindros/gastos');
      comprobanteUrl = subida.url;
      comprobantePublicId = subida.publicId;
    }

    const [resultado] = await pool.query(
      `INSERT INTO gastos
        (fecha, id_categoria, descripcion, monto, metodo_pago, numero_comprobante,
         comprobante_url, comprobante_public_id, observacion, id_usuario)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fecha || new Date(),
        id_categoria,
        descripcion.trim(),
        montoNum,
        metodo_pago,
        numero_comprobante || null,
        comprobanteUrl,
        comprobantePublicId,
        observacion || null,
        req.usuario.id_usuario,
      ]
    );

    const [filas] = await pool.query(
      `SELECT g.*, c.nombre AS categoria_nombre, u.nombre_completo AS usuario_nombre
       FROM gastos g
       INNER JOIN categorias_gastos c ON c.id_categoria = g.id_categoria
       INNER JOIN usuarios u ON u.id_usuario = g.id_usuario
       WHERE g.id_gasto = ?`,
      [resultado.insertId]
    );

    res.status(201).json({ mensaje: 'Gasto registrado correctamente.', gasto: filas[0] });
  } catch (error) {
    if (comprobantePublicId) await eliminarImagen(comprobantePublicId);
    throw error;
  }
});

const actualizarGasto = asyncHandler(async (req, res) => {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    if (req.file) eliminarArchivoTemporal(req.file.path);
    return res.status(400).json({ mensaje: 'Datos inválidos.', errores: errores.array() });
  }

  const { id } = req.params;
  const [filasExistentes] = await pool.query('SELECT * FROM gastos WHERE id_gasto = ? AND activo = 1', [id]);

  if (filasExistentes.length === 0) {
    if (req.file) eliminarArchivoTemporal(req.file.path);
    return res.status(404).json({ mensaje: 'Gasto no encontrado.' });
  }

  const gastoActual = filasExistentes[0];

  if (!esAdministrador(req) && gastoActual.id_usuario !== req.usuario.id_usuario) {
    if (req.file) eliminarArchivoTemporal(req.file.path);
    return res.status(403).json({ mensaje: 'No tiene permisos para editar este gasto.' });
  }

  const { fecha, id_categoria, descripcion, monto, metodo_pago, numero_comprobante, observacion, eliminar_comprobante } = req.body;

  const montoNum = Number(monto ?? gastoActual.monto);

  if (!descripcion || descripcion.trim() === '') {
    if (req.file) eliminarArchivoTemporal(req.file.path);
    return res.status(400).json({ mensaje: 'La descripción es obligatoria.' });
  }
  if (!(montoNum > 0)) {
    if (req.file) eliminarArchivoTemporal(req.file.path);
    return res.status(400).json({ mensaje: 'El monto debe ser mayor que cero.' });
  }

  let comprobanteUrl = gastoActual.comprobante_url;
  let comprobantePublicId = gastoActual.comprobante_public_id;

  if (req.file) {
    const subida = await subirImagen(req.file.path, 'sistema-cilindros/gastos');
    if (comprobantePublicId) await eliminarImagen(comprobantePublicId);
    comprobanteUrl = subida.url;
    comprobantePublicId = subida.publicId;
  } else if (eliminar_comprobante === 'true' || eliminar_comprobante === true) {
    if (comprobantePublicId) await eliminarImagen(comprobantePublicId);
    comprobanteUrl = null;
    comprobantePublicId = null;
  }

  await pool.query(
    `UPDATE gastos SET
      fecha = ?, id_categoria = ?, descripcion = ?, monto = ?, metodo_pago = ?,
      numero_comprobante = ?, comprobante_url = ?, comprobante_public_id = ?,
      observacion = ?, fecha_actualizacion = NOW()
     WHERE id_gasto = ?`,
    [
      fecha || gastoActual.fecha,
      id_categoria || gastoActual.id_categoria,
      descripcion.trim(),
      montoNum,
      metodo_pago || gastoActual.metodo_pago,
      numero_comprobante ?? gastoActual.numero_comprobante,
      comprobanteUrl,
      comprobantePublicId,
      observacion ?? gastoActual.observacion,
      id,
    ]
  );

  const [filas] = await pool.query(
    `SELECT g.*, c.nombre AS categoria_nombre, u.nombre_completo AS usuario_nombre
     FROM gastos g
     INNER JOIN categorias_gastos c ON c.id_categoria = g.id_categoria
     INNER JOIN usuarios u ON u.id_usuario = g.id_usuario
     WHERE g.id_gasto = ?`,
    [id]
  );

  res.json({ mensaje: 'Gasto actualizado correctamente.', gasto: filas[0] });
});

const eliminarGasto = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [filas] = await pool.query('SELECT * FROM gastos WHERE id_gasto = ? AND activo = 1', [id]);

  if (filas.length === 0) {
    return res.status(404).json({ mensaje: 'Gasto no encontrado.' });
  }

  // Borrado lógico: se conserva el registro y el comprobante como respaldo.
  await pool.query('UPDATE gastos SET activo = 0, fecha_actualizacion = NOW() WHERE id_gasto = ?', [id]);

  res.json({ mensaje: 'Gasto eliminado correctamente.' });
});

const obtenerComprobante = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [filas] = await pool.query(
    `SELECT g.id_gasto, g.fecha, g.descripcion, g.monto, g.metodo_pago, g.numero_comprobante,
            g.comprobante_url, g.comprobante_public_id, c.nombre AS categoria_nombre,
            u.nombre_completo AS usuario_nombre
     FROM gastos g
     INNER JOIN categorias_gastos c ON c.id_categoria = g.id_categoria
     INNER JOIN usuarios u ON u.id_usuario = g.id_usuario
     WHERE g.id_gasto = ? AND g.activo = 1`,
    [id]
  );

  if (filas.length === 0) {
    return res.status(404).json({ mensaje: 'Gasto no encontrado.' });
  }

  res.json(filas[0]);
});

const listarCategorias = asyncHandler(async (req, res) => {
  const [filas] = await pool.query('SELECT * FROM categorias_gastos WHERE estado = 1 ORDER BY nombre');
  res.json(filas);
});

module.exports = {
  listarGastos,
  obtenerGasto,
  crearGasto,
  actualizarGasto,
  eliminarGasto,
  obtenerComprobante,
  listarCategorias,
};
