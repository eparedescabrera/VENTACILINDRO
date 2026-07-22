const fs = require('fs');
const path = require('path');
const cloudinary = require('../config/cloudinary');

const CARPETA_UPLOADS = path.join(__dirname, '..', '..', 'uploads');

function valorEnv(nombre) {
  const valor = process.env[nombre];
  if (valor == null) return '';
  return String(valor).trim();
}

function cloudinaryConfigurado() {
  return Boolean(
    valorEnv('CLOUDINARY_CLOUD_NAME') &&
      valorEnv('CLOUDINARY_API_KEY') &&
      valorEnv('CLOUDINARY_API_SECRET')
  );
}

function urlBaseBackend(req) {
  const configurada = valorEnv('BACKEND_URL');
  if (configurada) return configurada.replace(/\/$/, '');

  const dominioRailway = valorEnv('RAILWAY_PUBLIC_DOMAIN');
  if (dominioRailway) return `https://${dominioRailway.replace(/\/$/, '')}`;

  if (req) {
    const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
    const host = req.get('x-forwarded-host') || req.get('host');
    if (host) return `${proto}://${host}`.replace(/\/$/, '');
  }

  return `http://localhost:${process.env.PORT || 3000}`;
}

function asegurarCarpeta(carpeta) {
  if (!fs.existsSync(carpeta)) {
    fs.mkdirSync(carpeta, { recursive: true });
  }
}

/**
 * Reescribe URLs locales con el host público actual (evita localhost o BACKEND_URL viejo).
 */
function resolverUrlImagen(url, publicId, req) {
  if (publicId && String(publicId).startsWith('local:')) {
    const relativo = String(publicId).slice('local:'.length).replace(/^\/+/, '');
    return `${urlBaseBackend(req)}/uploads/${relativo}`;
  }

  if (url && String(url).includes('/uploads/')) {
    const idx = String(url).indexOf('/uploads/');
    return `${urlBaseBackend(req)}${String(url).slice(idx)}`;
  }

  return url || null;
}

function archivoLocalExiste(publicId) {
  if (!publicId || !String(publicId).startsWith('local:')) return null;
  const relativo = String(publicId).slice('local:'.length).replace(/^\/+/, '');
  const ruta = path.join(CARPETA_UPLOADS, relativo);
  return fs.existsSync(ruta) ? ruta : null;
}

/**
 * Guarda la imagen en disco local y devuelve una URL servida por Express.
 */
function guardarImagenLocal(rutaArchivo, carpeta = 'comprobantes', req) {
  const destinoDir = path.join(CARPETA_UPLOADS, carpeta);
  asegurarCarpeta(destinoDir);

  const extension = path.extname(rutaArchivo) || '.jpg';
  const nombre = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
  const destino = path.join(destinoDir, nombre);

  fs.copyFileSync(rutaArchivo, destino);
  eliminarArchivoTemporal(rutaArchivo);

  const publicId = `local:${carpeta}/${nombre}`;
  return {
    url: resolverUrlImagen(null, publicId, req),
    publicId,
  };
}

/**
 * Sube un archivo a Cloudinary si está configurado; si no, lo guarda en disco local.
 * En producción Railway exige Cloudinary (el disco es temporal).
 */
async function subirImagen(rutaArchivo, carpeta = 'sistema-cilindros/comprobantes', req) {
  if (!cloudinaryConfigurado()) {
    const enProduccion =
      String(process.env.NODE_ENV || '').toLowerCase() === 'production' ||
      Boolean(valorEnv('RAILWAY_ENVIRONMENT') || valorEnv('RAILWAY_PUBLIC_DOMAIN'));

    if (enProduccion) {
      const error = new Error(
        'Cloudinary no está configurado en Railway. Agregue CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET para que las fotos no se pierdan.'
      );
      error.status = 503;
      throw error;
    }

    console.warn('Cloudinary no configurado: guardando imagen en disco local.');
    const carpetaLocal = carpeta.includes('logo') ? 'logo' : carpeta.includes('gastos') ? 'gastos' : 'comprobantes';
    return guardarImagenLocal(rutaArchivo, carpetaLocal, req);
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
  resolverUrlImagen,
  archivoLocalExiste,
  CARPETA_UPLOADS,
};
