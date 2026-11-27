/**
 * Un límite propio de intentos, en la memoria del servicio. Existe porque los
 * límites de Supabase Auth son por IP y todos los pedidos le llegan desde la IP
 * del servicio (supabase.com/docs/guides/auth/rate-limits): sin un límite aquí,
 * unas 150 contraseñas malas en cinco minutos gastarían el cupo de todos y nadie
 * podría entrar. Aquí se cuenta por la IP de la persona y por lo que intenta (un
 * correo, una sesión), y se corta antes de llamar a Supabase.
 *
 * Es una ventana fija por clave: hasta `maximo` intentos cada `ventanaMs`. Guarda
 * como mucho `clavesMaximas` claves; si se llena, suelta primero las vencidas y
 * después las más viejas, para que la memoria nunca crezca sin tope.
 *
 * Lo que NO hace, y queda escrito como pendiente en sistema/supabase/LEEME.md:
 * vive en cada copia de la función (Supabase puede correr varias, y una copia
 * nueva empieza en cero), así que no es un límite compartido. Antes de abrir el
 * registro al público hace falta uno compartido (una regla de límite en el
 * Worker de Cloudflare o una tabla en la base).
 */

export interface OpcionesDelLimite {
  readonly maximo: number;
  readonly ventanaMs: number;
  readonly clavesMaximas: number;
}

export interface Limite {
  /** Si la clave todavía tiene intentos en su ventana. No cuenta nada. */
  queda(clave: string, ahoraMs: number): boolean;
  /** Cuenta un intento de la clave. */
  contar(clave: string, ahoraMs: number): void;
}

interface Ventana {
  readonly desde: number;
  cuenta: number;
}

export function crearLimite(op: OpcionesDelLimite): Limite {
  const ventanas = new Map<string, Ventana>();

  const vigente = (clave: string, ahoraMs: number): Ventana | undefined => {
    const v = ventanas.get(clave);
    if (v !== undefined && ahoraMs - v.desde >= op.ventanaMs) {
      ventanas.delete(clave);
      return undefined;
    }
    return v;
  };

  function hacerLugar(ahoraMs: number): void {
    if (ventanas.size < op.clavesMaximas) return;
    for (const [clave, v] of ventanas) if (ahoraMs - v.desde >= op.ventanaMs) ventanas.delete(clave);
    // Un Map recorre en el orden en que se agregó: la primera es la más vieja.
    for (const clave of ventanas.keys()) {
      if (ventanas.size < op.clavesMaximas) break;
      ventanas.delete(clave);
    }
  }

  return {
    queda(clave, ahoraMs) {
      return (vigente(clave, ahoraMs)?.cuenta ?? 0) < op.maximo;
    },
    contar(clave, ahoraMs) {
      const v = vigente(clave, ahoraMs);
      if (v !== undefined) {
        v.cuenta += 1;
        return;
      }
      hacerLugar(ahoraMs);
      ventanas.set(clave, { desde: ahoraMs, cuenta: 1 });
    },
  };
}
