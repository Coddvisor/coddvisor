// Prueba la guardia de valores fijos: qué atrapa y qué deja pasar.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { revisarCarpeta, revisarTexto } from './valores-fijos.mjs';

const atrapa = (linea, ruta = 'ventas/calculo.ts') => revisarTexto(ruta, linea).map((h) => h.id);

describe('guardia de valores fijos', () => {
  test('el código del sistema no tiene valores fijos', async () => {
    assert.deepEqual((await revisarCarpeta()).hallazgos, []);
  });

  for (const [caso, linea, regla] of [
    ['decidir por país', "if (empresa.pais === 'PE') {", 'VF-01'],
    ['decidir por nombre de plan', 'if (plan.nombre == "pro") activar();', 'VF-01'],
    ['decidir por un cliente concreto', "const especial = tenantId === 'bodega-rosita';", 'VF-01'],
    ['decidir por rubro, con el texto primero', "if ('ferreteria' === empresa.rubro) {", 'VF-01'],
    ['la tasa de un impuesto', 'const IGV = 0.18;', 'VF-02'],
    ['un monto de referencia legal', 'const config = { uit: 5000 };', 'VF-02'],
    ['un color en un componente', "const estilo = { color: '#FF8F1F' };", 'VF-03'],
    ['un color en una hoja de estilos', '.boton { background: #0B1841; }', 'VF-03'],
    ['un color con rgb', 'border-color: rgb(11, 24, 65);', 'VF-03'],
    ['el id de una fila', "const cajaPrincipal = '01938a7e-5b1c-7c3a-9f2e-3d4b5a6c7d8e';", 'VF-04'],
    ['el símbolo de la moneda', "const precio = 'S/ ' + total;", 'VF-05'],
    ['el símbolo de la moneda en una plantilla', 'const precio = `S/ ${total}`;', 'VF-05'],
  ]) {
    test(`atrapa ${caso}`, () => {
      assert.deepEqual(atrapa(linea), [regla]);
    });
  }

  for (const [caso, linea, ruta] of [
    ['preguntar por un derecho del plan', "if (await puede(empresa, 'planilla.habilitado')) {"],
    ['comparar un estado del documento', "if (venta.estado === 'confirmada') {"],
    ['leer un parámetro legal con su fecha', "const tasa = await parametro(pais, 'ventas.igv.tasa', venta.fecha);"],
    ['empezar un acumulador de retenciones en cero', 'let retencion = 0;'],
    ['usar un papel de color', '.boton { background: var(--boton); }'],
    ['un enlace a una sección de la página', "const destino = '#vender';"],
    ['definir los colores en su único archivo', '--cobalto: #0B1841;', 'marca/colores.css'],
    ['un ejemplo dentro de una prueba', "const IGV = 0.18;", 'ventas/calculo.test.ts'],
    ['una excepción declarada con su motivo', "const marca = '#FF8F1F'; // valor-fijo-permitido: color del logo en el PDF"],
  ]) {
    test(`deja pasar ${caso}`, () => {
      assert.deepEqual(atrapa(linea, ruta), []);
    });
  }
});
