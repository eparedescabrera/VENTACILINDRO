/**
 * Script para crear (o restablecer) el usuario administrador inicial.
 * Ejecutar con: npm run seed:admin
 *
 * Usuario:    admin
 * Contraseña: Admin123*
 */
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
require('dotenv').config();

const USUARIO_ADMIN = 'admin';
const NOMBRE_ADMIN = 'Administrador del Sistema';
const PASSWORD_ADMIN = 'Admin123*';

async function crearAdmin() {
  try {
    const [roles] = await pool.query("SELECT id_rol FROM roles WHERE nombre = 'Administrador'");

    if (roles.length === 0) {
      console.error('No existe el rol Administrador. Ejecute primero el script schema.sql.');
      process.exit(1);
    }

    const idRolAdmin = roles[0].id_rol;
    const hash = await bcrypt.hash(PASSWORD_ADMIN, 10);

    const [existente] = await pool.query('SELECT id_usuario FROM usuarios WHERE nombre_usuario = ?', [USUARIO_ADMIN]);

    if (existente.length > 0) {
      await pool.query(
        'UPDATE usuarios SET password_hash = ?, id_rol = ?, estado = 1 WHERE nombre_usuario = ?',
        [hash, idRolAdmin, USUARIO_ADMIN]
      );
      console.log('El usuario administrador ya existía. Contraseña restablecida correctamente.');
    } else {
      await pool.query(
        `INSERT INTO usuarios (nombre_completo, nombre_usuario, correo, password_hash, id_rol)
         VALUES (?, ?, ?, ?, ?)`,
        [NOMBRE_ADMIN, USUARIO_ADMIN, 'admin@distribuidoragas.com', hash, idRolAdmin]
      );
      console.log('Usuario administrador creado correctamente.');
    }

    console.log(`Usuario: ${USUARIO_ADMIN}`);
    console.log(`Contraseña: ${PASSWORD_ADMIN}`);
    process.exit(0);
  } catch (error) {
    console.error('Error al crear el usuario administrador:', error.message);
    process.exit(1);
  }
}

crearAdmin();
