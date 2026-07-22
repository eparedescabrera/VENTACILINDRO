const fs = require('fs');
const path = require('path');
const cloudinary = require('../config/cloudinary');

const CARPETA_UPLOADS = path.join(__dirname, '..', '..', 'uploads');

function cloudinaryConfigurado() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

function urlBaseBackend() {
  return (process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
}

function asegurarCarpeta(carpeta) {
  if (!fs.existsSync(carpeta)) {
    fs.mkdirSync(carpeta, { recursive: true });
  }
}

/**
 * Guarda la imagen en disco local y devuelve una URL servida por Express.
 */
function guardarImagenLocal(rutaArchivo, carpeta = 'comprobantes') {
  const destinoDir = path.join(CARPETA_UPLOADS, carpeta);
  asegurarCarpeta(destinoDir);

  const extension = path.extname(rutaArchivo) || '.jpg';
  const nombre = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
  const destino = path.join(destinoDir, nombre);

  fs.copyFileSync(rutaArchivo, destino);
  eliminarArchivoTemporal(rutaArchivo);

  return {
    url: `${urlBaseBackend()}/uploads/${carpeta}/${nombre}`,
    publicId: `local:${carpeta}/${nombre}`,
  };
}

/**
 * Sube un archivo a Cloudinary si está configurado; si no, lo guarda en disco local.
 * Así las ventas/gastos se pueden guardar aunque Cloudinary no tenga credenciales.
 */
async function subirImagen(rutaArchivo, carpeta = 'sistema-cilindros/comprobantes') {
  if (!cloudinaryConfigurado()) {
    console.warn('Cloudinary no configurado: guardando imagen en disco local.');
    const carpetaLocal = carpeta.includes('logo') ? 'logo' : carpeta.includes('gastos') ? 'gastos' : 'comprobantes';
    return guardarImagenLocal(rutaArchivo, carpetaLocal);
  }

  try {
    const resultado = await cloudinary.uploader.upload(rutaArchivo, {
      folder: carpeta,
      resource_type: 'image',
    });
    return { url: resultado.secure_url, publicId: resultado.public_id };
  } finally {
    eliminarArchivoTemporal(rutaArchivo);
  }
}

/**
 * Elimina una imagen de Cloudinary o del disco local según el public_id.
 */
async function eliminarImagen(publicId) {
  if (!publicId) return;

  if (String(publicId).startsWith('local:')) {
    const relativo = String(publicId).slice('local:'.length);
    const ruta = path.join(CARPETA_UPLOADS, relativo);
    eliminarArchivoTemporal(ruta);
    return;
  }

  if (!cloudinaryConfigurado()) return;

  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('No se pudo eliminar la imagen de Cloudinary:', error.message);
  }
}

function eliminarArchivoTemporal(rutaArchivo) {
  if (rutaArchivo && fs.existsSync(rutaArchivo)) {
    fs.unlink(rutaArchivo, (error) => {
      if (error) console.error('No se pudo eliminar el archivo temporal:', error.message);
    });
  }
}

module.exports = {
  subirImagen,
  eliminarImagen,
  eliminarArchivoTemporal,
  cloudinaryConfigurado,
  CARPETA_UPLOADS,
};
