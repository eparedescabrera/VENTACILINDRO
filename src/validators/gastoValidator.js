const { body } = require('express-validator');

const validarGasto = [
  body('descripcion').notEmpty().withMessage('La descripción es obligatoria.'),
  body('id_categoria').notEmpty().withMessage('La categoría es obligatoria.'),
  body('monto')
    .notEmpty().withMessage('El monto es obligatorio.')
    .isFloat({ gt: 0 }).withMessage('El monto debe ser mayor que cero.'),
  body('metodo_pago')
    .isIn(['Efectivo', 'SINPE', 'Transferencia', 'Tarjeta'])
    .withMessage('Método de pago inválido.'),
];

module.exports = { validarGasto };
