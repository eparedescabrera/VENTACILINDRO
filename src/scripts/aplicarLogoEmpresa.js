/**
 * Actualiza el logo y nombre de la empresa con el archivo local.
 * Ejecutar: node src/scripts/aplicarLogoEmpresa.js
 */
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

async function aplicarLogo() {
  const logoLocal = path.join(__dirname, '..', '..', 'uploads', 'logo', 'logo-empresa.png');
  if (!fs.existsSync(logoLocal)) {
    console.error('No se encontró el archivo del logo en uploads/logo/logo-empresa.png');
    process.exit(1);
  }

  const baseUrl = (process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
  const logoUrl = `${baseUrl}/uploads/logo/logo-empresa.png`;
  const logoPublicId = 'local:logo/logo-empresa.png';

  const conexion = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sistema_cilindros',
  });

  try {
    const [filas] = await conexion.query('SELECT id_configuracion FROM configuracion_empresa ORDER BY id_configuracion DESC LIMIT 1');

    if (filas.length === 0) {
      await conexion.query(
        `INSERT INTO configuracion_empresa
          (nombre_empresa, cedula_juridica, telefono, correo, direccion, logo_url, logo_public_id, mensaje_reporte)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'GRUPO GAS GUANACASTE SRL',
          '0-000-000000',
          '0000-0000',
          'contacto@grupogasguanacaste.com',
          'Guanacaste, Costa Rica',
          logoUrl,
          logoPublicId,
          'Gracias por su confianza. GRUPO GAS GUANACASTE SRL',
        ]
      );
      console.log('Configuración creada con el logo de GRUPO GAS GUANACASTE SRL.');
    } else {
      await conexion.query(
        `UPDATE configuracion_empresa SET
          nombre_empresa = ?,
          logo_url = ?,
          logo_public_id = ?,
          mensaje_reporte = COALESCE(NULLIF(mensaje_reporte, ''), 'Gracias por su confianza. GRUPO GAS GUANACASTE SRL'),
          fecha_actualizacion = NOW()
         WHERE id_configuracion = ?`,
        ['GRUPO GAS GUANACASTE SRL', logoUrl, logoPublicId, filas[0].id_configuracion]
      );
      console.log('Logo y nombre de empresa actualizados: GRUPO GAS GUANACASTE SRL');
    }

    console.log('URL del logo:', logoUrl);
    process.exit(0);
  } catch (error) {
    console.error('Error al aplicar el logo:', error.message);
    process.exit(1);
  } finally {
    await conexion.end();
  }
}

aplicarLogo();
