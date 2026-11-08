const app = require('./app');
const { verificarConexion } = require('./config/db');
const { cloudinaryConfigurado } = require('./utils/cloudinaryHelper');
const { asegurarEsquemaProformas } = require('./database/asegurarEsquemaProformas');
require('dotenv').config();

const PUERTO = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

async function iniciar() {
  // 1) Escuchar de inmediato para pasar el healthcheck de Railway.
  app.listen(PUERTO, HOST, () => {
    console.log(`Servidor backend escuchando en ${HOST}:${PUERTO}`);
    if (cloudinaryConfigurado()) {
      console.log('Cloudinary: activo (imagenes permanentes)');
    } else {
      console.warn('Cloudinary: NO configurado (en Railway las imagenes se pierden al reiniciar)');
    }
  });

  // 2) MySQL + esquema en segundo plano (no bloquea /api/salud).
  try {
    const ok = await verificarConexion(6, 2000, { salir: false });
    if (!ok) {
      console.error('MySQL no disponible al iniciar; el API sigue en pie para el healthcheck.');
      return;
    }
    await asegurarEsquemaProformas();
  } catch (error) {
    console.error('Error post-arranque (MySQL/proformas):', error.message);
  }
}

iniciar().catch((error) => {
  console.error('Error al iniciar el servidor:', error.message);
  process.exit(1);
});
