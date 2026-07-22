const app = require('./app');
const { verificarConexion } = require('./config/db');
const { cloudinaryConfigurado } = require('./utils/cloudinaryHelper');
require('dotenv').config();

const PUERTO = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

async function iniciar() {
  await verificarConexion();
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
