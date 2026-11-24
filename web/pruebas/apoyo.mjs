// Apoyo para las pruebas: un PostgreSQL de verdad en memoria (PGlite) con lo mínimo de Supabase
// (los papeles anon y authenticated, auth.users y auth.uid()) y la migración del sitio tal cual se
// aplica en el proyecto. Así las pruebas corren las mismas funciones y permisos que producción.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';

const CARPETA = new URL('../supabase/migraciones/', import.meta.url);

// Lo que Supabase ya trae y la migración usa.
const SUPABASE_MINIMO = `
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
  $$;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
  GRANT USAGE ON SCHEMA public TO anon, authenticated;
`;

export async function baseNueva() {
  const db = new PGlite();
  await db.exec(SUPABASE_MINIMO);
  for (const archivo of readdirSync(CARPETA).filter((a) => a.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(new URL(archivo, CARPETA), 'utf8'));
  }
  return db;
}

// Corre `sql` como lo haría la API de Supabase: con el papel dado, la sesión (sub) y las cabeceras.
export async function como(db, papel, sql, params = [], { usuario = null, cabeceras = {} } = {}) {
  await db.exec('RESET ROLE');
  await db.query(`SELECT set_config('request.jwt.claims', $1, false), set_config('request.headers', $2, false)`,
    [usuario ? JSON.stringify({ sub: usuario }) : '', JSON.stringify(cabeceras)]);
  await db.exec(`SET ROLE ${papel}`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('RESET ROLE');
  }
}

export const ID_SOPORTE = '11111111-1111-4111-8111-111111111111';
export const ID_EXTRANO = '22222222-2222-4222-8222-222222222222';

// Un usuario de Supabase Auth confirmado y registrado como colaborador.
export async function conColaborador(db) {
  await db.query(`INSERT INTO auth.users VALUES ($1, 'soporte@coddvisor.com', now()), ($2, 'curioso@ejemplo.com', now())`,
    [ID_SOPORTE, ID_EXTRANO]);
  await db.exec(`INSERT INTO sitio.colaboradores (correo, nombre) VALUES ('soporte@coddvisor.com', 'Equipo')`);
}
