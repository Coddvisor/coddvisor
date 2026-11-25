// Revisa las reglas del código: pureza, fronteras, plata y promesas.
// Uso: npm run verificar:codigo

import ts from 'typescript';
import { crearPrograma, versionEsperada } from './programa.mjs';
import { REGLAS, revisarPrograma } from './reglas.mjs';

// Con otra versión del compilador, el árbol y los tipos pueden cambiar y una regla
// dejaría de ver lo suyo sin avisar.
if (ts.version !== versionEsperada()) {
  console.error(`\n✘ Esta guardia se probó con TypeScript ${versionEsperada()} y hay instalado ${ts.version}. Corra npm ci.\n`);
  process.exit(1);
}

const todo = crearPrograma();
const problemas = [...todo.programa.getOptionsDiagnostics(), ...todo.programa.getGlobalDiagnostics()];
if (problemas.length > 0) {
  for (const p of problemas) console.error(ts.flattenDiagnosticMessageText(p.messageText, '\n'));
  console.error('\n✘ El compilador no está bien configurado: la guardia no vería todo.\n');
  process.exit(1);
}
const hallazgos = revisarPrograma(todo);
if (todo.archivos.length === 0) {
  console.error('\n✘ No se revisó ningún archivo. Algo está mal en la guardia.\n');
  process.exit(1);
}
for (const h of hallazgos) console.error(`✘ ${h.regla}  ${h.archivo}:${h.linea}\n      ${h.detalle}\n      ${REGLAS[h.regla]}.`);
if (hallazgos.length > 0) {
  console.error(`\n${hallazgos.length} falta${hallazgos.length === 1 ? '' : 's'} en el código. Las reglas están en arquitectura/bases/05-modulos.md.\n`);
  process.exit(1);
}
console.log(`Código: ${todo.archivos.length} archivos y ${Object.keys(REGLAS).length} reglas, sin faltas.`);
