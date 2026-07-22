const multer = require('multer');

/**
 * Middleware global de manejo de errores.
 * Debe registrarse al final, después de todas las rutas.
 */
function manejadorErrores(err, req, res, next) {
  console.error('Error capturado:', err.message);

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ mensaje: 'El archivo supera el tamaño máximo permitido de 5 MB.' });
    }
    return res.status(400).json({ mensaje: `Error al procesar el archivo: ${err.message}` });
  }

  if (err.message && err.message.includes('Formato de archivo no permitido')) {
    return res.status(400).json({ mensaje: err.message });
  }

  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ mensaje: 'El registro ya existe en el sistema.' });
  }

  const codigoEstado = err.status || err.statusCode || 500;
  const mensaje = err.mensaje || err.message || 'Ocurrió un error interno en el servidor.';

  res.status(codigoEstado).json({ mensaje });
}

function rutaNoEncontrada(req, res) {
  res.status(404).json({ mensaje: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}

module.exports = { manejadorErrores, rutaNoEncontrada };
