const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { subirImagen, eliminarImagen, eliminarArchivoTemporal } = require('../utils/cloudinaryHelper');

const obtenerConfiguracion = asyncHandler(async (req, res) => {
  const [filas] = await pool.query('SELECT * FROM configuracion_empresa ORDER BY id_configuracion DESC LIMIT 1');
  res.json(filas[0] || null);
});

const actualizarConfiguracion = asyncHandler(async (req, res) => {
  const { nombre_empresa, cedula_juridica, telefono, correo, direccion, mensaje_reporte } = req.body;

  if (!nombre_empresa || nombre_empresa.trim() === '') {
    return res.status(400).json({ mensaje: 'El nombre de la empresa es obligatorio.' });
  }

  const [existente] = await pool.query('SELECT * FROM configuracion_empresa ORDER BY id_configuracion DESC LIMIT 1');

  if (existente.length === 0) {
    await pool.query(
      `INSERT INTO configuracion_empresa (nombre_empresa, cedula_juridica, telefono, correo, direccion, mensaje_reporte)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nombre_empresa.trim(), cedula_juridica || null, telefono || null, correo || null, direccion || null, mensaje_reporte || null]
    );
  } else {
    await pool.query(
      `UPDATE configuracion_empresa SET
        nombre_empresa = ?, cedula_juridica = ?, telefono = ?, correo = ?, direccion = ?,
        mensaje_reporte = ?, fecha_actualizacion = NOW()
       WHERE id_configuracion = ?`,
      [
        nombre_empresa.trim(),
        cedula_juridica || null,
        telefono || null,
        correo || null,
        direccion || null,
        mensaje_reporte || null,
        existente[0].id_configuracion,
      ]
    );
  }

  const [filas] = await pool.query('SELECT * FROM configuracion_empresa ORDER BY id_configuracion DESC LIMIT 1');
  res.json({ mensaje: 'Configuración actualizada correctamente.', configuracion: filas[0] });
});

const subirLogo = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ mensaje: 'Debe seleccionar una imagen para el logo.' });
  }

  const [existente] = await pool.query('SELECT * FROM configuracion_empresa ORDER BY id_configuracion DESC LIMIT 1');

  try {
    const subida = await subirImagen(req.file.path, 'sistema-cilindros/logo', req);

    if (existente.length === 0) {
      await pool.query(
        `INSERT INTO configuracion_empresa (nombre_empresa, logo_url, logo_public_id)
         VALUES (?, ?, ?)`,
        ['Distribuidora de Gas', subida.url, subida.publicId]
      );
    } else {
      // Se reemplaza el logo anterior en Cloudinary si existía.
      if (existente[0].logo_public_id) await eliminarImagen(existente[0].logo_public_id);
      await pool.query(
        'UPDATE configuracion_empresa SET logo_url = ?, logo_public_id = ?, fecha_actualizacion = NOW() WHERE id_configuracion = ?',
        [subida.url, subida.publicId, existente[0].id_configuracion]
      );
    }

    const [filas] = await pool.query('SELECT * FROM configuracion_empresa ORDER BY id_configuracion DESC LIMIT 1');
    res.json({ mensaje: 'Logo actualizado correctamente.', configuracion: filas[0] });
  } catch (error) {
    eliminarArchivoTemporal(req.file.path);
    throw error;
  }
});

const eliminarLogo = asyncHandler(async (req, res) => {
  const [existente] = await pool.query('SELECT * FROM configuracion_empresa ORDER BY id_configuracion DESC LIMIT 1');

  if (existente.length === 0 || !existente[0].logo_public_id) {
    return res.status(404).json({ mensaje: 'No hay un logo configurado.' });
  }

  await eliminarImagen(existente[0].logo_public_id);
  await pool.query(
    'UPDATE configuracion_empresa SET logo_url = NULL, logo_public_id = NULL, fecha_actualizacion = NOW() WHERE id_configuracion = ?',
    [existente[0].id_configuracion]
  );

  res.json({ mensaje: 'Logo eliminado correctamente.' });
});

module.exports = { obtenerConfiguracion, actualizarConfiguracion, subirLogo, eliminarLogo };
