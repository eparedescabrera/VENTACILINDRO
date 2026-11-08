const app = require('./app');
const { verificarConexion } = require('./config/db');
const { cloudinaryConfigurado } = require('./utils/cloudinaryHelper');
const { asegurarEsquemaProformas } = require('./database/asegurarEsquemaProformas');
require('dotenv').config();

const PUERTO = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

async function iniciar() {
  // Conexión rápida: si falla, Railway reintenta el contenedor.
  await verificarConexion(5, 2000);

  // Escuchar ANTES del esquema para que el healthcheck de Railway pase a tiempo.
  app.listen(PUERTO, HOST, () => {
    console.log(`Servidor backend escuchando en ${HOST}:${PUERTO}`);
    if (cloudinaryConfigurado()) {
      console.log('Cloudinary: activo (imagenes permanentes)');
    } else {
      console.warn('Cloudinary: NO configurado (en Railway las imagenes se pierden al reiniciar)');
    }
  });

  try {
    await asegurarEsquemaProformas();
  } catch (error) {
    // No tumbar el API: el healthcheck ya puede responder; se reintenta en el próximo deploy.
    console.error('No se pudo asegurar el esquema de proformas:', error.message);
  }
}

iniciar().catch((error) => {
  console.error('Error al iniciar el servidor:', error.message);
  process.exit(1);
});
