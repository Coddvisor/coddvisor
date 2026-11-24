// Apoyo para las pruebas: un PostgreSQL de verdad en memoria (PGlite) con lo mínimo de Supabase
// (los papeles anon y authenticated, auth.users y auth.uid()) y la migración del sitio tal cual se
// aplica en el proyecto. Así las pruebas corren las mismas funciones y permisos que producción.
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, readdirSync } from 'node:fs';

const CARPETA = new URL('../supabase/migraciones/', import.meta.url);

// Lo que Supabase ya trae y la migración usa. pg_net (enviar correos) y Vault (la clave de Resend)
// no existen en PGlite: se reemplazan por una tabla que anota cada envío y otra con las claves.
const SUPABASE_MINIMO = `
  CREATE SCHEMA extensions;
  CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
  CREATE SCHEMA net;
  CREATE TABLE net.enviados (id serial PRIMARY KEY, url text, headers jsonb, body jsonb);
  CREATE FUNCTION net.http_post(url text, body jsonb, params jsonb DEFAULT '{}', headers jsonb DEFAULT '{}', timeout_milliseconds int DEFAULT 5000)
    RETURNS bigint LANGUAGE sql AS $$ INSERT INTO net.enviados (url, headers, body) VALUES (url, headers, body) RETURNING id $$;
  CREATE SCHEMA vault;
  CREATE TABLE vault.decrypted_secrets (name text PRIMARY KEY, decrypted_secret text);
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz);
  CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
    SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT nullif(auth.jwt() ->> 'sub', '')::uuid
  $$;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated;
  GRANT EXECUTE ON FUNCTION auth.uid(), auth.jwt() TO anon, authenticated;
  GRANT USAGE ON SCHEMA public TO anon, authenticated;
`;

export async function baseNueva() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_MINIMO);
  for (const archivo of readdirSync(CARPETA).filter((a) => a.endsWith('.sql')).sort()) {
    // pg_net no existe en PGlite: se quitan las líneas que la instalan (aquí la reemplaza net.http_post).
    await db.exec(readFileSync(new URL(archivo, CARPETA), 'utf8').replace(/^(CREATE|DROP) EXTENSION[^\n]*pg_net[^\n]*$/gm, ''));
  }
  return db;
}

// Corre `sql` como lo haría la API de Supabase: con el papel dado, la sesión (sub y session_id) y
// las cabeceras. Cada usuario de prueba tiene su propia sesión, salvo que se pida otra.
export async function como(db, papel, sql, params = [], { usuario = null, sesion = null, cabeceras = {} } = {}) {
  await db.exec('RESET ROLE');
  await db.query(`SELECT set_config('request.jwt.claims', $1, false), set_config('request.headers', $2, false)`,
    [usuario ? JSON.stringify({ sub: usuario, session_id: sesion || SESIONES[usuario] || usuario }) : '', JSON.stringify(cabeceras)]);
  await db.exec(`SET ROLE ${papel}`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('RESET ROLE');
  }
}

export const ID_SOPORTE = '11111111-1111-4111-8111-111111111111';
export const ID_EXTRANO = '22222222-2222-4222-8222-222222222222';
export const SESION_SOPORTE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SESIONES = { [ID_SOPORTE]: SESION_SOPORTE };

// Un usuario de Supabase Auth confirmado, registrado como colaborador que administra. Con
// `verificado`, su sesión ya escribió el código del correo (si no, el panel no le responde).
export async function conColaborador(db, { verificado = true } = {}) {
  await db.query(`INSERT INTO auth.users VALUES ($1, 'soporte@coddvisor.com', now()), ($2, 'curioso@ejemplo.com', now())`,
    [ID_SOPORTE, ID_EXTRANO]);
  await db.exec(`INSERT INTO sitio.colaboradores (correo, nombre, administra) VALUES ('soporte@coddvisor.com', 'Equipo', true)`);
  if (verificado) {
    await db.query(`INSERT INTO sitio.sesiones_verificadas (sesion_id, correo, vence_en) VALUES ($1, 'soporte@coddvisor.com', now() + interval '7 days')`,
      [SESION_SOPORTE]);
  }
}
