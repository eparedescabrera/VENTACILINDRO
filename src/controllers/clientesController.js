const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

const listarClientes = asyncHandler(async (req, res) => {
  const { buscar, estado, pagina = 1, limite = 50 } = req.query;

  const condiciones = [];
  const parametros = [];

  // Por defecto solo activos, salvo que se pida "todos" o "inactivos"
  if (estado === '0' || estado === 'inactivo') {
    condiciones.push('estado = 0');
  } else if (estado === 'todos') {
    // sin filtro de estado
  } else {
    condiciones.push('estado = 1');
  }

  if (buscar) {
    condiciones.push('(nombre LIKE ? OR cedula LIKE ? OR telefono LIKE ? OR lugar LIKE ?)');
    parametros.push(`%${buscar}%`, `%${buscar}%`, `%${buscar}%`, `%${buscar}%`);
  }

  const whereSql = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  const [totalFilas] = await pool.query(`SELECT COUNT(*) AS total FROM clientes ${whereSql}`, parametros);
  const total = totalFilas[0].total;

  const paginaNum = Math.max(parseInt(pagina, 10) || 1, 1);
  const limiteNum = Math.max(parseInt(limite, 10) || 50, 1);
  const desplazamiento = (paginaNum - 1) * limiteNum;

  const [filas] = await pool.query(
    `SELECT * FROM clientes ${whereSql}
     ORDER BY id_cliente ASC
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

const listarClientesActivos = asyncHandler(async (req, res) => {
  const [filas] = await pool.query(
    `SELECT id_cliente, nombre, cedula, telefono, lugar, direccion
     FROM clientes
     WHERE estado = 1
     ORDER BY nombre ASC`
  );
  res.json(filas);
});

const obtenerCliente = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [filas] = await pool.query('SELECT * FROM clientes WHERE id_cliente = ?', [id]);

  if (filas.length === 0) {
    return res.status(404).json({ mensaje: 'Cliente no encontrado.' });
  }

  res.json(filas[0]);
});

const crearCliente = asyncHandler(async (req, res) => {
  const { nombre, cedula, telefono, correo, direccion, lugar, observacion } = req.body;

  if (!nombre || nombre.trim() === '') {
    return res.status(400).json({ mensaje: 'El nombre del cliente es obligatorio.' });
  }

  const [resultado] = await pool.query(
    `INSERT INTO clientes (nombre, cedula, telefono, correo, direccion, lugar, observacion)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      nombre.trim(),
      cedula || null,
      telefono || null,
      correo || null,
      direccion || null,
      lugar || null,
      observacion || null,
    ]
  );

  const [filas] = await pool.query('SELECT * FROM clientes WHERE id_cliente = ?', [resultado.insertId]);
  res.status(201).json({ mensaje: 'Cliente registrado correctamente.', cliente: filas[0] });
});

const actualizarCliente = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { nombre, cedula, telefono, correo, direccion, lugar, observacion, estado } = req.body;

  const [existentes] = await pool.query('SELECT * FROM clientes WHERE id_cliente = ?', [id]);
  if (existentes.length === 0) {
    return res.status(404).json({ mensaje: 'Cliente no encontrado.' });
  }

  if (!nombre || nombre.trim() === '') {
    return res.status(400).json({ mensaje: 'El nombre del cliente es obligatorio.' });
  }

  const cliente = existentes[0];

  await pool.query(
    `UPDATE clientes SET
      nombre = ?, cedula = ?, telefono = ?, correo = ?, direccion = ?,
      lugar = ?, observacion = ?, estado = ?, fecha_actualizacion = NOW()
     WHERE id_cliente = ?`,
    [
      nombre.trim(),
      cedula ?? cliente.cedula,
      telefono ?? cliente.telefono,
      correo ?? cliente.correo,
      direccion ?? cliente.direccion,
      lugar ?? cliente.lugar,
      observacion ?? cliente.observacion,
      estado === undefined ? cliente.estado : estado,
      id,
    ]
  );

  const [filas] = await pool.query('SELECT * FROM clientes WHERE id_cliente = ?', [id]);
  res.json({ mensaje: 'Cliente actualizado correctamente.', cliente: filas[0] });
});

const eliminarCliente = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [existentes] = await pool.query('SELECT * FROM clientes WHERE id_cliente = ?', [id]);

  if (existentes.length === 0) {
    return res.status(404).json({ mensaje: 'Cliente no encontrado.' });
  }

  // Borrado lógico
  await pool.query('UPDATE clientes SET estado = 0, fecha_actualizacion = NOW() WHERE id_cliente = ?', [id]);
  res.json({ mensaje: 'Cliente eliminado correctamente.' });
});

module.exports = {
  listarClientes,
  listarClientesActivos,
  obtenerCliente,
  crearCliente,
  actualizarCliente,
  eliminarCliente,
};
