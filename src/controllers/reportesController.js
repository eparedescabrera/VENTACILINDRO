const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

function esAdministrador(req) {
  return req.usuario?.rol === 'Administrador';
}

function filtrosVentas(req) {
  const { fecha_inicio, fecha_fin, cliente, metodo_pago, estado_pago, id_usuario } = req.query;
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
  if (metodo_pago) {
    condiciones.push('v.metodo_pago = ?');
    parametros.push(metodo_pago);
  }
  if (estado_pago) {
    condiciones.push('v.estado_pago = ?');
    parametros.push(estado_pago);
  }

  if (!esAdministrador(req)) {
    condiciones.push('v.id_usuario = ?');
    parametros.push(req.usuario.id_usuario);
  } else if (id_usuario) {
    condiciones.push('v.id_usuario = ?');
    parametros.push(id_usuario);
  }

  return { whereSql: `WHERE ${condiciones.join(' AND ')}`, parametros };
}

function filtrosGastos(req) {
  const { fecha_inicio, fecha_fin, id_categoria, metodo_pago, id_usuario } = req.query;
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

  return { whereSql: `WHERE ${condiciones.join(' AND ')}`, parametros };
}

const reporteVentas = asyncHandler(async (req, res) => {
  const { whereSql, parametros } = filtrosVentas(req);

  // Solo columnas necesarias (sin comprobantes) y totales en SQL en paralelo.
  const [filasResultado, totalesResultado] = await Promise.all([
    pool.query(
      `SELECT
        v.id_venta, v.fecha, v.cliente, v.lugar, v.tipo_cilindro, v.cantidad,
        v.precio_unitario, v.total, v.metodo_pago, v.estado_pago,
        u.nombre_completo AS usuario_nombre
       FROM ventas v
       INNER JOIN usuarios u ON u.id_usuario = v.id_usuario
       ${whereSql}
       ORDER BY v.fecha ASC
       LIMIT 5000`,
      parametros
    ),
    pool.query(
      `SELECT
        COALESCE(SUM(CASE WHEN v.estado_pago != 'Anulado' THEN v.total ELSE 0 END), 0) AS total_vendido,
        COALESCE(SUM(CASE WHEN v.metodo_pago = 'Efectivo' AND v.estado_pago = 'Pagado' THEN v.total ELSE 0 END), 0) AS total_efectivo,
        COALESCE(SUM(CASE WHEN v.metodo_pago = 'SINPE' AND v.estado_pago = 'Pagado' THEN v.total ELSE 0 END), 0) AS total_sinpe,
        COALESCE(SUM(CASE WHEN v.metodo_pago = 'Transferencia' AND v.estado_pago = 'Pagado' THEN v.total ELSE 0 END), 0) AS total_transferencia,
        COALESCE(SUM(CASE WHEN v.metodo_pago = 'Credito' THEN v.total ELSE 0 END), 0) AS total_credito,
        COALESCE(SUM(CASE WHEN v.estado_pago = 'Pendiente' THEN v.total ELSE 0 END), 0) AS total_pendiente
       FROM ventas v
       ${whereSql}`,
      parametros
    ),
  ]);

  const totales = totalesResultado[0][0];

  res.json({
    datos: filasResultado[0],
    totales: {
      total_vendido: Number(totales.total_vendido),
      total_efectivo: Number(totales.total_efectivo),
      total_sinpe: Number(totales.total_sinpe),
      total_transferencia: Number(totales.total_transferencia),
      total_credito: Number(totales.total_credito),
      total_pendiente: Number(totales.total_pendiente),
    },
    filtros: req.query,
  });
});

const reporteGastos = asyncHandler(async (req, res) => {
  const { whereSql, parametros } = filtrosGastos(req);

  const [filasResultado, totalesResultado] = await Promise.all([
    pool.query(
      `SELECT
        g.id_gasto, g.fecha, g.descripcion, g.monto, g.metodo_pago,
        c.nombre AS categoria_nombre, u.nombre_completo AS usuario_nombre
       FROM gastos g
       INNER JOIN categorias_gastos c ON c.id_categoria = g.id_categoria
       INNER JOIN usuarios u ON u.id_usuario = g.id_usuario
       ${whereSql}
       ORDER BY g.fecha ASC
       LIMIT 5000`,
      parametros
    ),
    pool.query(
      `SELECT
        COALESCE(SUM(g.monto), 0) AS total_gastos,
        c.nombre AS categoria_nombre,
        COALESCE(SUM(g.monto), 0) AS monto_categoria
       FROM gastos g
       INNER JOIN categorias_gastos c ON c.id_categoria = g.id_categoria
       ${whereSql}
       GROUP BY c.id_categoria, c.nombre`,
      parametros
    ),
  ]);

  const porCategoria = {};
  let totalGastos = 0;
  totalesResultado[0].forEach((fila) => {
    porCategoria[fila.categoria_nombre] = Number(fila.monto_categoria);
    totalGastos += Number(fila.monto_categoria);
  });

  res.json({
    datos: filasResultado[0],
    totales: { total_gastos: totalGastos, por_categoria: porCategoria },
    filtros: req.query,
  });
});

const reporteResumen = asyncHandler(async (req, res) => {
  const { fecha_inicio, fecha_fin, id_usuario } = req.query;

  const condicionesVentas = ['activo = 1'];
  const parametrosVentas = [];
  const condicionesGastos = ['activo = 1'];
  const parametrosGastos = [];

  if (fecha_inicio) {
    condicionesVentas.push('fecha >= ?');
    condicionesGastos.push('fecha >= ?');
    parametrosVentas.push(`${fecha_inicio} 00:00:00`);
    parametrosGastos.push(`${fecha_inicio} 00:00:00`);
  }
  if (fecha_fin) {
    condicionesVentas.push('fecha <= ?');
    condicionesGastos.push('fecha <= ?');
    parametrosVentas.push(`${fecha_fin} 23:59:59`);
    parametrosGastos.push(`${fecha_fin} 23:59:59`);
  }

  if (!esAdministrador(req)) {
    condicionesVentas.push('id_usuario = ?');
    condicionesGastos.push('id_usuario = ?');
    parametrosVentas.push(req.usuario.id_usuario);
    parametrosGastos.push(req.usuario.id_usuario);
  } else if (id_usuario) {
    condicionesVentas.push('id_usuario = ?');
    condicionesGastos.push('id_usuario = ?');
    parametrosVentas.push(id_usuario);
    parametrosGastos.push(id_usuario);
  }

  const [ventasFilas, gastosFilas] = await Promise.all([
    pool.query(
      `SELECT
        COALESCE(SUM(CASE WHEN estado_pago != 'Anulado' THEN total ELSE 0 END), 0) AS total_vendido,
        COALESCE(SUM(CASE WHEN metodo_pago = 'Efectivo' AND estado_pago = 'Pagado' THEN total ELSE 0 END), 0) AS total_efectivo,
        COALESCE(SUM(CASE WHEN metodo_pago = 'SINPE' AND estado_pago = 'Pagado' THEN total ELSE 0 END), 0) AS total_sinpe,
        COALESCE(SUM(CASE WHEN metodo_pago = 'Transferencia' AND estado_pago = 'Pagado' THEN total ELSE 0 END), 0) AS total_transferencia,
        COALESCE(SUM(CASE WHEN metodo_pago = 'Credito' THEN total ELSE 0 END), 0) AS total_credito,
        COALESCE(SUM(CASE WHEN estado_pago = 'Pagado' THEN total ELSE 0 END), 0) AS total_pagado
       FROM ventas
       WHERE ${condicionesVentas.join(' AND ')}`,
      parametrosVentas
    ),
    pool.query(
      `SELECT COALESCE(SUM(monto), 0) AS total_gastos
       FROM gastos
       WHERE ${condicionesGastos.join(' AND ')}`,
      parametrosGastos
    ),
  ]);

  const totalPagado = Number(ventasFilas[0][0].total_pagado);
  const totalGastos = Number(gastosFilas[0][0].total_gastos);

  res.json({
    total_vendido: Number(ventasFilas[0][0].total_vendido),
    total_efectivo: Number(ventasFilas[0][0].total_efectivo),
    total_sinpe: Number(ventasFilas[0][0].total_sinpe),
    total_transferencia: Number(ventasFilas[0][0].total_transferencia),
    total_credito: Number(ventasFilas[0][0].total_credito),
    total_gastos: totalGastos,
    saldo_periodo: totalPagado - totalGastos,
  });
});

module.exports = { reporteVentas, reporteGastos, reporteResumen };
