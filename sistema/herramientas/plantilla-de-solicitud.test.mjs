// La plantilla de las solicitudes de revisión (.github/pull_request_template.md) trae
// la lista de arquitectura/bases/06-antes-de-unir.md, porque esa página pide que quien
// propone un cambio la responda en su solicitud. Es una copia, y una copia se
// desactualiza en silencio: esta prueba falla apenas las dos listas dejan de ser
// iguales. Las lee con la misma función que usa el revisor con IA, así las tres
// (la página, la plantilla y el revisor) entienden la lista de la misma manera.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

import { extraerPreguntas } from './revisor-ia.mjs';

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');
const lista = leer('../../arquitectura/bases/06-antes-de-unir.md');
const plantilla = leer('../../.github/pull_request_template.md');

// El número de cada pregunta (P01, P02...) depende de su lugar; se compara lo que dice.
const textos = (preguntas) => preguntas.map(({ grupo, pregunta }) => ({ grupo, pregunta }));

describe('la plantilla de las solicitudes de revisión', () => {
  for (const encabezado of ['## Lo que revisa la máquina', '## Lo que responde una persona']) {
    test(`«${encabezado.slice(3)}» dice lo mismo en la plantilla y en 06-antes-de-unir.md`, () => {
      const original = extraerPreguntas(lista, encabezado);
      assert.ok(original.length > 0, `06-antes-de-unir.md ya no tiene la sección «${encabezado.slice(3)}»`);
      assert.deepEqual(
        textos(extraerPreguntas(plantilla, encabezado)),
        textos(original),
        'Si cambió la lista de 06-antes-de-unir.md, copie el cambio en .github/pull_request_template.md.',
      );
    });
  }

  test('pide lo que la fundadora necesita para decidir', () => {
    const lineas = plantilla.split('\n');
    for (const seccion of ['## Qué cambia', '## Qué decide la fundadora', '## Trabajo relacionado', '## Cómo se comprobó', '## Revisión independiente']) {
      assert.ok(lineas.includes(seccion), `falta la sección «${seccion.slice(3)}»`);
    }
  });

  test('no usa el punto medio', () => {
    assert.ok(!plantilla.includes('·'));
  });
});
