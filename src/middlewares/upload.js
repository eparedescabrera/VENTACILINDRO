const multer = require('multer');
const path = require('path');
const fs = require('fs');

const carpetaTemporal = path.join(__dirname, '..', '..', 'tmp');
if (!fs.existsSync(carpetaTemporal)) {
  fs.mkdirSync(carpetaTemporal, { recursive: true });
}

const TIPOS_PERMITIDOS = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const EXTENSIONES_PERMITIDAS = ['.png', '.jpg', '.jpeg', '.webp'];
const TAMANO_MAXIMO = 5 * 1024 * 1024; // 5 MB

const almacenamiento = multer.diskStorage({
  destination: (req, file, cb) => cb(null, carpetaTemporal),
  filename: (req, file, cb) => {
    const sufijo = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `comprobante-${sufijo}${path.extname(file.originalname).toLowerCase()}`);
  },
});

function filtroArchivo(req, file, cb) {
  const extension = path.extname(file.originalname).toLowerCase();
  const tipoValido = TIPOS_PERMITIDOS.includes(file.mimetype);
  const extensionValida = EXTENSIONES_PERMITIDAS.includes(extension);

  if (!tipoValido || !extensionValida) {
    return cb(new Error('Formato de archivo no permitido. Solo se aceptan JPG, JPEG, PNG y WEBP.'));
  }
  cb(null, true);
}

const upload = multer({
  storage: almacenamiento,
  fileFilter: filtroArchivo,
  limits: { fileSize: TAMANO_MAXIMO, files: 1 },
});

module.exports = upload;
