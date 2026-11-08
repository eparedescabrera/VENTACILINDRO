const TASA_IVA = 0.13;

/**
 * Calcula subtotal, IVA y total de una proforma.
 * - aplicaIva=false: total = suma de líneas
 * - aplicaIva=true y preciosIncluyenIva=false: IVA se suma al subtotal
 * - aplicaIva=true y preciosIncluyenIva=true: el total es la suma; se desglosa neto + IVA
 */
function calcularTotalesProforma(lineas, { aplicaIva = true, preciosIncluyenIva = false } = {}) {
  const sumaLineas = Number(
    lineas
      .reduce((acum, linea) => {
        const cantidad = Number(linea.cantidad) || 0;
        const precio = Number(linea.precio_unitario) || 0;
        return acum + cantidad * precio;
      }, 0)
      .toFixed(2)
  );

  if (!aplicaIva) {
    return {
      subtotal: sumaLineas,
      monto_iva: 0,
      total: sumaLineas,
    };
  }

  if (preciosIncluyenIva) {
    const total = sumaLineas;
    const subtotal = Number((total / (1 + TASA_IVA)).toFixed(2));
    const monto_iva = Number((total - subtotal).toFixed(2));
    return { subtotal, monto_iva, total };
  }

  const subtotal = sumaLineas;
  const monto_iva = Number((subtotal * TASA_IVA).toFixed(2));
  const total = Number((subtotal + monto_iva).toFixed(2));
  return { subtotal, monto_iva, total };
}

function formatearNumeroProforma(idProforma) {
  return `PF-${String(idProforma).padStart(6, '0')}`;
}

module.exports = {
  TASA_IVA,
  calcularTotalesProforma,
  formatearNumeroProforma,
};
