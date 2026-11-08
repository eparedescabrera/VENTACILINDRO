const app = require('./app');
const { verificarConexion } = require('./config/db');
const { cloudinaryConfigurado } = require('./utils/cloudinaryHelper');
const { asegurarEsquemaProformas } = require('./database/asegurarEsquemaProformas');
require('dotenv').config();

const PUERTO = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

async function iniciar() {
  await verificarConexion();

  try {
    await asegurarEsquemaProformas();
  } catch (error) {
    console.error('No se pudo asegurar el esquema de proformas:', error.message);
    process.exit(1);
  }

  app.listen(PUERTO, HOST, () => {
    console.log(`Servidor backend escuchando en ${HOST}:${PUERTO}`);
    if (cloudinaryConfigurado()) {
      console.log('Cloudinary: activo (imagenes permanentes)');
    } else {
      console.warn('Cloudinary: NO configurado (en Railway las imagenes se pierden al reiniciar)');
    }
  });
}

iniciar();
