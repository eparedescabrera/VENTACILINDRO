const { pool } = require('../config/db');
const { validationResult } = require('express-validator');
const asyncHandler = require('../utils/asyncHandler');
const { subirImagen, eliminarImagen, eliminarArchivoTemporal } = require('../utils/cloudinaryHelper');

const METODOS_CON_REFERENCIA = ['SINPE', 'Transferencia'];

function esAdministrador(req) {
  return req.usuario?.rol === 'Administrador';
}

const listarVentas = asyncHandler(async (req, res) => {
  const {
    fecha_inicio,
    fecha_fin,
    cliente,
    lugar,
    metodo_pago,
    estado_pago,
    id_usuario,
    buscar,
    pagina = 1,
    limite = 10,
  } = req.query;

  const condiciones = ['v.activo = 1'];
  const parametros = [];

  if (fecha_inicio) {
    condiciones.push('v.fecha >= ?');
    parametros.push(`${fecha_inicio} 00:00:00`);
  }
  if (fecha_fin) {
    condiciones.push('v.fecha <= ?');
    parametros.push(`${fecha_fin} 23:59:59`);
  }
  if (cliente) {
    condiciones.push('v.cliente LIKE ?');
    parametros.push(`%${cliente}%`);
  }
  if (lugar) {
    condiciones.push('v.lugar LIKE ?');
    parametros.push(`%${lugar}%`);
  }
  if (metodo_pago) {
    condiciones.push('v.metodo_pago = ?');
    parametros.push(metodo_pago);
  }
  if (estado_pago) {
    condiciones.push('v.estado_pago = ?');
    parametros.push(estado_pago);
  }

  // Un vendedor solo puede ver sus propios movimientos
  if (!esAdministrador(req)) {
    condiciones.push('v.id_usuario = ?');
    parametros.push(req.usuario.id_usuario);
  } else if (id_usuario) {
    condiciones.push('v.id_usuario = ?');
    parametros.push(id_usuario);
  }

  if (buscar) {
    condiciones.push('(v.cliente LIKE ? OR v.tipo_cilindro LIKE ? OR v.numero_referencia LIKE ?)');
    parametros.push(`%${buscar}%`, `%${buscar}%`, `%${buscar}%`);
  }

  const whereSql = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  const [totalFilas] = await pool.query(
    `SELECT COUNT(*) AS total FROM ventas v ${whereSql}`,
    parametros
  );
  const total = totalFilas[0].total;

  const paginaNum = Math.max(parseInt(pagina, 10) || 1, 1);
  const limiteNum = Math.max(parseInt(limite, 10) || 10, 1);
  const desplazamiento = (paginaNum - 1) * limiteNum;

  const [filas] = await pool.query(
    `SELECT v.*, u.nombre_completo AS usuario_nombre
     FROM ventas v
     INNER JOIN usuarios u ON u.id_usuario = v.id_usuario
     ${whereSql}
     ORDER BY v.fecha DESC, v.id_venta DESC
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

const obtenerVenta = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [filas] = await pool.query(
    `SELECT v.*, u.nombre_completo AS usuario_nombre
     FROM ventas v
     INNER JOIN usuarios u ON u.id_usuario = v.id_usuario
     WHERE v.id_venta = ? AND v.activo = 1`,
    [id]
  );

  if (filas.length === 0) {
    return res.status(404).json({ mensaje: 'Venta no encontrada.' });
  }

  const venta = filas[0];
  if (!esAdministrador(req) && venta.id_usuario !== req.usuario.id_usuario) {
    return res.status(403).json({ mensaje: 'No tiene permisos para consultar esta venta.' });
  }

  res.json(venta);
});

const crearVenta = asyncHandler(async (req, res) => {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    if (req.file) eliminarArchivoTemporal(req.file.path);
    return res.status(400).json({ mensaje: 'Datos inválidos.', errores: errores.array() });
  }

  const {
    fecha,
    cliente,
    id_cliente,
    lugar,
    tipo_cilindro,
    cantidad,
    precio_unitario,
    metodo_pago,
    numero_referencia,
    observacion,
  } = req.body;

  const cantidadNum = Number(cantidad);
  const precioNum = Number(precio_unitario);

  if (!cliente || cliente.trim() === '') {
    if (req.file) eliminarArchivoTemporal(req.file.path);
    return res.status(400).json({ mensaje: 'El cliente es obligatorio.' });
  }
  if (!(cantidadNum > 0)) {
    if (req.file) eliminarArchivoTemporal(req.file.path);
    return res.status(400).json({ mensaje: 'La cantidad debe ser mayor que cero.' });
  }
  if (!(precioNum > 0)) {
    if (req.file) eliminarArchivoTemporal(req.file.path);
    return res.status(400).json({ mensaje: 'El precio unitario debe ser mayor que cero.' });
  }

  // El backend recalcula el total: nunca se confía en el valor enviado desde React.
  const total = Number((cantidadNum * precioNum).toFixed(2));

  // Si el método de pago es crédito, el estado inicial siempre es Pendiente.
  let estadoPago = metodo_pago === 'Credito' ? 'Pendiente' : 'Pagado';
  if (req.body.estado_pago === 'Pendiente') estadoPago = 'Pendiente';

  let comprobanteUrl = null;
  let comprobantePublicId = null;

  try {
    if (req.file) {
      const subida = await subirImagen(req.file.path);
      comprobanteUrl = subida.url;
      comprobantePublicId = subida.publicId;
    }

    const [resultado] = await pool.query(
      `INSERT INTO ventas
        (fecha, cliente, id_cliente, lugar, tipo_cilindro, cantidad, precio_unitario, total,
         metodo_pago, estado_pago, numero_referencia, comprobante_url, comprobante_public_id,
         observacion, id_usuario)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fecha || new Date(),
        cliente.trim(),
        id_cliente || null,
        lugar || null,
        tipo_cilindro,
        cantidadNum,
        precioNum,
        total,
        metodo_pago,
        estadoPago,
        METODOS_CON_REFERENCIA.includes(metodo_pago) ? numero_referencia || null : null,
        comprobanteUrl,
        comprobantePublicId,
        observacion || null,
        req.usuario.id_usuario,
      ]
    );

    const [filas] = await pool.query(
      `SELECT v.*, u.nombre_completo AS usuario_nombre
       FROM ventas v INNER JOIN usuarios u ON u.id_usuario = v.id_usuario
       WHERE v.id_venta = ?`,
      [resultado.insertId]
    );

    res.status(201).json({ mensaje: 'Venta registrada correctamente.', venta: filas[0] });
  } catch (error) {
    // Si la venta no se pudo guardar, se elimina la imagen subida.
    if (comprobantePublicId) await eliminarImagen(comprobantePublicId);
    throw error;
  }
});

const actualizarVenta = asyncHandler(async (req, res) => {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    if (req.file) eliminarArchivoTemporal(req.file.path);
    return res.status(400).json({ mensaje: 'Datos inválidos.', errores: errores.array() });
  }

  const { id } = req.params;
  const [filasExistentes] = await pool.query('SELECT * FROM ventas WHERE id_venta = ? AND activo = 1', [id]);

  if (filasExistentes.length === 0) {
    if (req.file) eliminarArchivoTemporal(req.file.path);
    return res.status(404).json({ mensaje: 'Venta no encontrada.' });
  }

  const ventaActual = filasExistentes[0];

  if (!esAdministrador(req) && ventaActual.id_usuario !== req.usuario.id_usuario) {
    if (req.file) eliminarArchivoTemporal(req.file.path);
    return res.status(403).json({ mensaje: 'No tiene permisos para editar esta venta.' });
  }

  const {
    fecha,
    cliente,
    id_cliente,
    lugar,
    tipo_cilindro,
    cantidad,
    precio_unitario,
    metodo_pago,
    estado_pago,
    numero_referencia,
    observacion,
    eliminar_comprobante,
  } = req.body;

  const cantidadNum = Number(cantidad ?? ventaActual.cantidad);
  const precioNum = Number(precio_unitario ?? ventaActual.precio_unitario);

  if (!cliente || cliente.trim() === '') {
    if (req.file) eliminarArchivoTemporal(req.file.path);
    return res.status(400).json({ mensaje: 'El cliente es obligatorio.' });
  }
  if (!(cantidadNum > 0)) {
    if (req.file) eliminarArchivoTemporal(req.file.path);
    return res.status(400).json({ mensaje: 'La cantidad debe ser mayor que cero.' });
  }
  if (!(precioNum > 0)) {
    if (req.file) eliminarArchivoTemporal(req.file.path);
    return res.status(400).json({ mensaje: 'El precio unitario debe ser mayor que cero.' });
  }

  const total = Number((cantidadNum * precioNum).toFixed(2));
  const metodoFinal = metodo_pago || ventaActual.metodo_pago;
  const estadoFinal = estado_pago || ventaActual.estado_pago;

  let comprobanteUrl = ventaActual.comprobante_url;
  let comprobantePublicId = ventaActual.comprobante_public_id;

  try {
    if (req.file) {
      // Se reemplaza el comprobante: se elimina el anterior de Cloudinary.
      const subida = await subirImagen(req.file.path);
      if (comprobantePublicId) await eliminarImagen(comprobantePublicId);
      comprobanteUrl = subida.url;
      comprobantePublicId = subida.publicId;
    } else if (eliminar_comprobante === 'true' || eliminar_comprobante === true) {
      if (comprobantePublicId) await eliminarImagen(comprobantePublicId);
      comprobanteUrl = null;
      comprobantePublicId = null;
    }

    await pool.query(
      `UPDATE ventas SET
        fecha = ?, cliente = ?, id_cliente = ?, lugar = ?, tipo_cilindro = ?, cantidad = ?, precio_unitario = ?,
        total = ?, metodo_pago = ?, estado_pago = ?, numero_referencia = ?,
        comprobante_url = ?, comprobante_public_id = ?, observacion = ?, fecha_actualizacion = NOW()
       WHERE id_venta = ?`,
      [
        fecha || ventaActual.fecha,
        cliente.trim(),
        id_cliente !== undefined ? id_cliente || null : ventaActual.id_cliente,
        lugar ?? ventaActual.lugar,
        tipo_cilindro || ventaActual.tipo_cilindro,
        cantidadNum,
        precioNum,
        total,
        metodoFinal,
        estadoFinal,
        METODOS_CON_REFERENCIA.includes(metodoFinal) ? numero_referencia ?? ventaActual.numero_referencia : null,
        comprobanteUrl,
        comprobantePublicId,
        observacion ?? ventaActual.observacion,
        id,
      ]
    );

    const [filas] = await pool.query(
      `SELECT v.*, u.nombre_completo AS usuario_nombre
       FROM ventas v INNER JOIN usuarios u ON u.id_usuario = v.id_usuario
       WHERE v.id_venta = ?`,
      [id]
    );

    res.json({ mensaje: 'Venta actualizada correctamente.', venta: filas[0] });
  } catch (error) {
    throw error;
  }
});

const marcarComoPagada = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [filas] = await pool.query('SELECT * FROM ventas WHERE id_venta = ? AND activo = 1', [id]);

  if (filas.length === 0) {
    return res.status(404).json({ mensaje: 'Venta no encontrada.' });
  }
  if (filas[0].estado_pago === 'Anulado') {
    return res.status(400).json({ mensaje: 'No se puede pagar una venta anulada.' });
  }

  await pool.query(
    "UPDATE ventas SET estado_pago = 'Pagado', fecha_actualizacion = NOW() WHERE id_venta = ?",
    [id]
  );

  res.json({ mensaje: 'Venta marcada como pagada.' });
});

const anularVenta = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [filas] = await pool.query('SELECT * FROM ventas WHERE id_venta = ? AND activo = 1', [id]);

  if (filas.length === 0) {
    return res.status(404).json({ mensaje: 'Venta no encontrada.' });
  }

  // Al anular se conserva el comprobante como respaldo; no se elimina de Cloudinary.
  await pool.query(
    "UPDATE ventas SET estado_pago = 'Anulado', fecha_actualizacion = NOW() WHERE id_venta = ?",
    [id]
  );

  res.json({ mensaje: 'Venta anulada correctamente.' });
});

const obtenerComprobante = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [filas] = await pool.query(
    `SELECT v.id_venta, v.fecha, v.cliente, v.total, v.metodo_pago, v.numero_referencia,
            v.comprobante_url, v.comprobante_public_id, u.nombre_completo AS usuario_nombre
     FROM ventas v INNER JOIN usuarios u ON u.id_usuario = v.id_usuario
     WHERE v.id_venta = ? AND v.activo = 1`,
    [id]
  );

  if (filas.length === 0) {
    return res.status(404).json({ mensaje: 'Venta no encontrada.' });
  }

  res.json(filas[0]);
});

module.exports = {
  listarVentas,
  obtenerVenta,
  crearVenta,
  actualizarVenta,
  marcarComoPagada,
  anularVenta,
  obtenerComprobante,
};
