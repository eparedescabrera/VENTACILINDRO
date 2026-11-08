const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { calcularTotalesProforma, formatearNumeroProforma } = require('../utils/calculoProforma');

const TIPOS_PERMITIDOS = ['cilindro', 'envase'];

function esAdministrador(req) {
  return req.usuario?.rol === 'Administrador';
}

function normalizarLineas(detalles = []) {
  return detalles.map((linea) => ({
    id_producto: Number(linea.id_producto),
    cantidad: Number(linea.cantidad),
    precio_unitario: Number(linea.precio_unitario),
  }));
}

async function cargarProductosMapa(ids) {
  if (!ids.length) return new Map();
  const placeholders = ids.map(() => '?').join(',');
  const [filas] = await pool.query(
    `SELECT id_producto, tipo, descripcion, tamano, precio_unitario, estado
     FROM productos
     WHERE id_producto IN (${placeholders})`,
    ids
  );
  return new Map(filas.map((p) => [Number(p.id_producto), p]));
}

async function validarYArmarDetalles(detallesEntrada) {
  const lineas = normalizarLineas(detallesEntrada);
  if (!lineas.length) {
    const error = new Error('Debe incluir al menos un cilindro o envase en la proforma.');
    error.status = 400;
    throw error;
  }

  for (const linea of lineas) {
    if (!linea.id_producto || !(linea.cantidad > 0) || !(linea.precio_unitario >= 0)) {
      const error = new Error('Cada línea debe tener producto, cantidad > 0 y precio válido.');
      error.status = 400;
      throw error;
    }
  }

  const mapa = await cargarProductosMapa([...new Set(lineas.map((l) => l.id_producto))]);
  const detalles = [];

  for (const linea of lineas) {
    const producto = mapa.get(linea.id_producto);
    if (!producto || !producto.estado) {
      const error = new Error(`Producto ${linea.id_producto} no encontrado o inactivo.`);
      error.status = 400;
      throw error;
    }
    if (!TIPOS_PERMITIDOS.includes(producto.tipo)) {
      const error = new Error('Solo se permiten cilindros de gas y envases.');
      error.status = 400;
      throw error;
    }

    const subtotal_linea = Number((linea.cantidad * linea.precio_unitario).toFixed(2));
    detalles.push({
      id_producto: producto.id_producto,
      tipo: producto.tipo,
      descripcion: producto.descripcion,
      tamano: producto.tamano,
      cantidad: linea.cantidad,
      precio_unitario: linea.precio_unitario,
      subtotal_linea,
    });
  }

  return detalles;
}

const listarProformas = asyncHandler(async (req, res) => {
  const { fecha_inicio, fecha_fin, buscar, pagina = 1, limite = 15 } = req.query;
  const condiciones = ['p.activo = 1'];
  const parametros = [];

  if (!esAdministrador(req)) {
    condiciones.push('p.id_usuario = ?');
    parametros.push(req.usuario.id_usuario);
  }

  if (fecha_inicio) {
    condiciones.push('p.fecha >= ?');
    parametros.push(`${fecha_inicio} 00:00:00`);
  }
  if (fecha_fin) {
    condiciones.push('p.fecha <= ?');
    parametros.push(`${fecha_fin} 23:59:59`);
  }
  if (buscar) {
    condiciones.push('(p.numero LIKE ? OR p.cliente_nombre LIKE ? OR p.lugar LIKE ?)');
    const like = `%${buscar}%`;
    parametros.push(like, like, like);
  }

  const where = `WHERE ${condiciones.join(' AND ')}`;
  const paginaNum = Math.max(1, Number(pagina) || 1);
  const limiteNum = Math.min(100, Math.max(1, Number(limite) || 15));
  const offset = (paginaNum - 1) * limiteNum;

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM proformas p ${where}`, parametros);
  const [filas] = await pool.query(
    `SELECT p.*, u.nombre_completo AS usuario_nombre
     FROM proformas p
     INNER JOIN usuarios u ON u.id_usuario = p.id_usuario
     ${where}
     ORDER BY p.fecha DESC, p.id_proforma DESC
     LIMIT ? OFFSET ?`,
    [...parametros, limiteNum, offset]
  );

  res.json({
    datos: filas,
    paginacion: {
      total: Number(total),
      pagina: paginaNum,
      limite: limiteNum,
      total_paginas: Math.ceil(Number(total) / limiteNum) || 1,
    },
  });
});

const obtenerProforma = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [filas] = await pool.query(
    `SELECT p.*, u.nombre_completo AS usuario_nombre
     FROM proformas p
     INNER JOIN usuarios u ON u.id_usuario = p.id_usuario
     WHERE p.id_proforma = ? AND p.activo = 1`,
    [id]
  );

  if (!filas.length) {
    return res.status(404).json({ mensaje: 'Proforma no encontrada.' });
  }

  const proforma = filas[0];
  if (!esAdministrador(req) && Number(proforma.id_usuario) !== Number(req.usuario.id_usuario)) {
    return res.status(403).json({ mensaje: 'No tiene permiso para ver esta proforma.' });
  }

  const [detalles] = await pool.query(
    `SELECT id_detalle, id_producto, tipo, descripcion, tamano, cantidad, precio_unitario, subtotal_linea
     FROM proforma_detalles
     WHERE id_proforma = ?
     ORDER BY id_detalle ASC`,
    [id]
  );

  res.json({ ...proforma, detalles });
});

const crearProforma = asyncHandler(async (req, res) => {
  const {
    fecha,
    id_cliente,
    cliente_nombre,
    cliente_cedula,
    cliente_telefono,
    cliente_direccion,
    lugar,
    aplica_iva = true,
    precios_incluyen_iva = false,
    observacion,
    detalles,
  } = req.body;

  if (!cliente_nombre || !String(cliente_nombre).trim()) {
    return res.status(400).json({ mensaje: 'El nombre del cliente es obligatorio.' });
  }

  const aplicaIvaBool =
    aplica_iva === true || aplica_iva === 'true' || aplica_iva === 1 || aplica_iva === '1';
  const preciosIncluyenIvaBool =
    precios_incluyen_iva === true ||
    precios_incluyen_iva === 'true' ||
    precios_incluyen_iva === 1 ||
    precios_incluyen_iva === '1';

  const detallesArmados = await validarYArmarDetalles(detalles);
  const totales = calcularTotalesProforma(detallesArmados, {
    aplicaIva: aplicaIvaBool,
    preciosIncluyenIva: preciosIncluyenIvaBool,
  });

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();

    const [resultado] = await conexion.query(
      `INSERT INTO proformas
        (numero, fecha, id_cliente, cliente_nombre, cliente_cedula, cliente_telefono, cliente_direccion,
         lugar, aplica_iva, precios_incluyen_iva, subtotal, monto_iva, total, observacion, id_usuario)
       VALUES ('TEMP', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fecha || new Date(),
        id_cliente || null,
        String(cliente_nombre).trim(),
        cliente_cedula || null,
        cliente_telefono || null,
        cliente_direccion || null,
        lugar || null,
        aplicaIvaBool,
        preciosIncluyenIvaBool,
        totales.subtotal,
        totales.monto_iva,
        totales.total,
        observacion || null,
        req.usuario.id_usuario,
      ]
    );

    const idProforma = resultado.insertId;
    const numero = formatearNumeroProforma(idProforma);
    await conexion.query('UPDATE proformas SET numero = ? WHERE id_proforma = ?', [numero, idProforma]);

    for (const detalle of detallesArmados) {
      await conexion.query(
        `INSERT INTO proforma_detalles
          (id_proforma, id_producto, tipo, descripcion, tamano, cantidad, precio_unitario, subtotal_linea)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          idProforma,
          detalle.id_producto,
          detalle.tipo,
          detalle.descripcion,
          detalle.tamano,
          detalle.cantidad,
          detalle.precio_unitario,
          detalle.subtotal_linea,
        ]
      );
    }

    await conexion.commit();

    const [filas] = await pool.query(
      `SELECT p.*, u.nombre_completo AS usuario_nombre
       FROM proformas p INNER JOIN usuarios u ON u.id_usuario = p.id_usuario
       WHERE p.id_proforma = ?`,
      [idProforma]
    );
    const [detallesGuardados] = await pool.query(
      'SELECT * FROM proforma_detalles WHERE id_proforma = ? ORDER BY id_detalle ASC',
      [idProforma]
    );

    res.status(201).json({
      mensaje: 'Proforma creada correctamente. No se descontaron existencias.',
      proforma: { ...filas[0], detalles: detallesGuardados },
    });
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
});

const anularProforma = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [filas] = await pool.query('SELECT * FROM proformas WHERE id_proforma = ? AND activo = 1', [id]);
  if (!filas.length) {
    return res.status(404).json({ mensaje: 'Proforma no encontrada.' });
  }

  if (!esAdministrador(req) && Number(filas[0].id_usuario) !== Number(req.usuario.id_usuario)) {
    return res.status(403).json({ mensaje: 'No tiene permiso para anular esta proforma.' });
  }

  await pool.query('UPDATE proformas SET activo = 0, fecha_actualizacion = NOW() WHERE id_proforma = ?', [id]);
  res.json({ mensaje: 'Proforma anulada correctamente.' });
});

module.exports = {
  listarProformas,
  obtenerProforma,
  crearProforma,
  anularProforma,
};
