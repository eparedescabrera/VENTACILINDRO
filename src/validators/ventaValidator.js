const { body } = require('express-validator');

const validarVenta = [
  body('cliente').notEmpty().withMessage('El cliente es obligatorio.'),
  body('tipo_cilindro').notEmpty().withMessage('El tipo de cilindro es obligatorio.'),
  body('cantidad')
    .notEmpty().withMessage('La cantidad es obligatoria.')
    .isFloat({ gt: 0 }).withMessage('La cantidad debe ser mayor que cero.'),
  body('precio_unitario')
    .notEmpty().withMessage('El precio unitario es obligatorio.')
    .isFloat({ gt: 0 }).withMessage('El precio unitario debe ser mayor que cero.'),
  body('metodo_pago')
    .isIn(['Efectivo', 'SINPE', 'Credito', 'Transferencia'])
    .withMessage('Método de pago inválido.'),
];

module.exports = { validarVenta };
