const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const ventasRoutes = require('./routes/ventasRoutes');
const gastosRoutes = require('./routes/gastosRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const reportesRoutes = require('./routes/reportesRoutes');
const configuracionRoutes = require('./routes/configuracionRoutes');
const usuariosRoutes = require('./routes/usuariosRoutes');
const clientesRoutes = require('./routes/clientesRoutes');
const { manejadorErrores, rutaNoEncontrada } = require('./middlewares/errorHandler');
const { CARPETA_UPLOADS } = require('./utils/cloudinaryHelper');

const app = express();

// Necesario detrás de proxies (Railway, Render, Vercel, etc.)
app.set('trust proxy', 1);

/**
 * FRONTEND_URL puede ser una o varias URLs separadas por coma.
 * Ejemplo: https://app.vercel.app,http://localhost:5173
 */
function obtenerOrigenesPermitidos() {
  const valor = process.env.FRONTEND_URL || '*';
  if (valor.trim() === '*') return true;
  return valor
    .split(',')
    .map((origen) => origen.trim())
    .filter(Boolean);
}

const origenesPermitidos = obtenerOrigenesPermitidos();

app.use(
  cors({
    origin(origin, callback) {
      // Permite herramientas sin Origin (Postman, health checks)
      if (!origin) return callback(null, true);
      if (origenesPermitidos === true) return callback(null, true);
      if (origenesPermitidos.includes(origin)) return callback(null, true);
      // Preview deployments de Vercel del mismo proyecto
      if (/^https:\/\/.*\.vercel\.app$/.test(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

app.use('/uploads', express.static(CARPETA_UPLOADS));

app.get('/api/salud', (req, res) => {
  res.json({
    estado: 'ok',
    mensaje: 'API del sistema de cilindros funcionando correctamente.',
    entorno: process.env.NODE_ENV || 'development',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/ventas', ventasRoutes);
app.use('/api/gastos', gastosRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/configuracion', configuracionRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/clientes', clientesRoutes);

app.use(rutaNoEncontrada);
app.use(manejadorErrores);

module.exports = app;
