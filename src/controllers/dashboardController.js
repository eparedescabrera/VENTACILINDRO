const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

function esAdministrador(req) {
  return req.usuario?.rol === 'Administrador';
}

function obtenerRangoFechas(query) {
  const { rango, fecha_inicio, fecha_fin } = query;
  const hoy = new Date();
  const formatear = (fecha) => fecha.toISOString().slice(0, 10);

  if (rango === 'semana') {
    const inicio = new Date(hoy);
    const diaSemana = (inicio.getDay() + 6) % 7; // Lunes = 0
    inicio.setDate(inicio.getDate() - diaSemana);
    return { inicio: formatear(inicio), fin: formatear(hoy) };
  }
  if (rango === 'mes') {
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    return { inicio: formatear(inicio), fin: formatear(hoy) };
  }
  if (rango === 'personalizado' && fecha_inicio && fecha_fin) {
    return { inicio: fecha_inicio, fin: fecha_fin };
  }
  return { inicio: formatear(hoy), fin: formatear(hoy) };
}

const resumen = asyncHandler(async (req, res) => {
  const { inicio, fin } = obtenerRangoFechas(req.query);
  const condicionUsuario = esAdministrador(req) ? '' : 'AND id_usuario = ?';
  const parametrosUsuario = esAdministrador(req) ? [] : [req.usuario.id_usuario];

  const [ventasFilas] = await pool.query(
    `SELECT
      COALESCE(SUM(CASE WHEN estado_pago != 'Anulado' THEN total ELSE 0 END), 0) AS total_vendido,
      COALESCE(SUM(CASE WHEN metodo_pago = 'Efectivo' AND estado_pago = 'Pagado' THEN total ELSE 0 END), 0) AS total_efectivo,
      COALESCE(SUM(CASE WHEN metodo_pago = 'SINPE' AND estado_pago = 'Pagado' THEN total ELSE 0 END), 0) AS total_sinpe,
      COALESCE(SUM(CASE WHEN metodo_pago = 'Credito' THEN total ELSE 0 END), 0) AS total_credito,
      COALESCE(SUM(CASE WHEN estado_pago = 'Pagado' THEN total ELSE 0 END), 0) AS total_pagado,
      COALESCE(SUM(CASE WHEN estado_pago = 'Pendiente' THEN total ELSE 0 END), 0) AS total_pendiente,
      COALESCE(SUM(CASE WHEN estado_pago != 'Anulado' THEN cantidad ELSE 0 END), 0) AS cilindros_vendidos,
      COALESCE(SUM(CASE WHEN estado_pago = 'Pendiente' THEN 1 ELSE 0 END), 0) AS ventas_pendientes
     FROM ventas
     WHERE activo = 1 AND fecha >= ? AND fecha <= ? ${condicionUsuario}`,
    [`${inicio} 00:00:00`, `${fin} 23:59:59`, ...parametrosUsuario]
  );

  const [gastosFilas] = await pool.query(
    `SELECT
      COALESCE(SUM(monto), 0) AS total_gastos,
      COALESCE(SUM(CASE WHEN metodo_pago = 'Efectivo' THEN monto ELSE 0 END), 0) AS gastos_efectivo
     FROM gastos
     WHERE activo = 1 AND fecha >= ? AND fecha <= ? ${condicionUsuario}`,
    [`${inicio} 00:00:00`, `${fin} 23:59:59`, ...parametrosUsuario]
  );

  const v = ventasFilas[0];
  const g = gastosFilas[0];

  const totalVendido = Number(v.total_vendido);
  const totalEfectivoVentas = Number(v.total_efectivo);
  const totalSinpe = Number(v.total_sinpe);
  const totalCredito = Number(v.total_credito);
  const totalPagado = Number(v.total_pagado);
  const totalGastos = Number(g.total_gastos);
  const gastosEfectivo = Number(g.gastos_efectivo);

  const saldoDia = totalPagado - totalGastos;
  const efectivoDisponible = totalEfectivoVentas - gastosEfectivo;

  res.json({
    rango: { inicio, fin },
    total_vendido: totalVendido,
    total_efectivo: totalEfectivoVentas,
    total_sinpe: totalSinpe,
    total_credito: totalCredito,
    total_gastos: totalGastos,
    gastos_efectivo: gastosEfectivo,
    efectivo_disponible: efectivoDisponible,
    saldo_dia: saldoDia,
    cilindros_vendidos: Number(v.cilindros_vendidos),
    ventas_pendientes: Number(v.ventas_pendientes),
  });
});

const ultimasVentas = asyncHandler(async (req, res) => {
  const condicionUsuario = esAdministrador(req) ? '' : 'AND v.id_usuario = ?';
  const parametrosUsuario = esAdministrador(req) ? [] : [req.usuario.id_usuario];

  const [filas] = await pool.query(
    `SELECT v.*, u.nombre_completo AS usuario_nombre
     FROM ventas v INNER JOIN usuarios u ON u.id_usuario = v.id_usuario
     WHERE v.activo = 1 ${condicionUsuario}
     ORDER BY v.fecha DESC, v.id_venta DESC
     LIMIT 8`,
    parametrosUsuario
  );

  res.json(filas);
});

const ultimosGastos = asyncHandler(async (req, res) => {
  const condicionUsuario = esAdministrador(req) ? '' : 'AND g.id_usuario = ?';
  const parametrosUsuario = esAdministrador(req) ? [] : [req.usuario.id_usuario];

  const [filas] = await pool.query(
    `SELECT g.*, c.nombre AS categoria_nombre, u.nombre_completo AS usuario_nombre
     FROM gastos g
     INNER JOIN categorias_gastos c ON c.id_categoria = g.id_categoria
     INNER JOIN usuarios u ON u.id_usuario = g.id_usuario
     WHERE g.activo = 1 ${condicionUsuario}
     ORDER BY g.fecha DESC, g.id_gasto DESC
     LIMIT 8`,
    parametrosUsuario
  );

  res.json(filas);
});

module.exports = { resumen, ultimasVentas, ultimosGastos };
