const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

const TIPOS_PERMITIDOS = ['cilindro', 'envase'];

const listarProductos = asyncHandler(async (req, res) => {
  const { tipo, todos } = req.query;
  const condiciones = [];
  const parametros = [];

  if (todos !== '1' && todos !== 'true') {
    condiciones.push('estado = 1');
  }

  if (tipo) {
    if (!TIPOS_PERMITIDOS.includes(tipo)) {
      return res.status(400).json({ mensaje: 'Tipo de producto inválido. Solo cilindro o envase.' });
    }
    condiciones.push('tipo = ?');
    parametros.push(tipo);
  } else {
    condiciones.push("tipo IN ('cilindro', 'envase')");
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const [filas] = await pool.query(
    `SELECT id_producto, tipo, codigo, descripcion, tamano, precio_unitario, estado
     FROM productos
     ${where}
     ORDER BY tipo ASC, tamano ASC`,
    parametros
  );

  res.json(filas);
});

const actualizarProducto = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { descripcion, precio_unitario, estado, codigo } = req.body;

  const [existentes] = await pool.query('SELECT * FROM productos WHERE id_producto = ?', [id]);
  if (!existentes.length) {
    return res.status(404).json({ mensaje: 'Producto no encontrado.' });
  }

  const producto = existentes[0];
  if (!TIPOS_PERMITIDOS.includes(producto.tipo)) {
    return res.status(400).json({ mensaje: 'Solo se permiten cilindros y envases.' });
  }

  const precio = precio_unitario != null ? Number(precio_unitario) : Number(producto.precio_unitario);
  if (!(precio >= 0)) {
    return res.status(400).json({ mensaje: 'El precio unitario no es válido.' });
  }

  await pool.query(
    `UPDATE productos SET
      descripcion = ?, codigo = ?, precio_unitario = ?, estado = ?, fecha_actualizacion = NOW()
     WHERE id_producto = ?`,
    [
      descripcion != null ? String(descripcion).trim() : producto.descripcion,
      codigo != null ? String(codigo).trim() || null : producto.codigo,
      precio,
      estado === undefined || estado === null ? producto.estado : Boolean(estado),
      id,
    ]
  );

  const [filas] = await pool.query('SELECT * FROM productos WHERE id_producto = ?', [id]);
  res.json({ mensaje: 'Producto actualizado correctamente.', producto: filas[0] });
});

module.exports = { listarProductos, actualizarProducto };
