const cloudinary = require('cloudinary').v2;
require('dotenv').config();

function valorEnv(nombre) {
  const valor = process.env[nombre];
  if (valor == null) return '';
  return String(valor).trim();
}

cloudinary.config({
  cloud_name: valorEnv('CLOUDINARY_CLOUD_NAME'),
  api_key: valorEnv('CLOUDINARY_API_KEY'),
  api_secret: valorEnv('CLOUDINARY_API_SECRET'),
});

module.exports = cloudinary;
