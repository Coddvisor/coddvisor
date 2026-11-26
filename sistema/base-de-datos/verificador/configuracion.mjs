// Lo que el verificador necesita saber y no puede leer de la base.
// Cambiar algo aquí es cambiar una regla: va con su explicación en
// arquitectura/bases/02-base-de-datos.md y lo aprueba el fundador.

export const configuracion = {
  // Qué puede hacer cada rol de la aplicación según la clase de la tabla.
  // Nadie tiene DELETE ni TRUNCATE: en Coddvisor nada se borra.
  // custodia: datos de un cliente que la aplicación solo lee y que escribe una
  // sola puerta (la membresía y sus roles). Por clase nadie escribe en ella.
  permisos: {
    coddvisor_app: {
      raiz: ['SELECT'],
      negocio: ['SELECT', 'INSERT', 'UPDATE'],
      libro: ['SELECT'],
      custodia: ['SELECT'],
      catalogo: ['SELECT'],
      control: [],
    },
    coddvisor_libros: {
      raiz: ['SELECT'],
      negocio: ['SELECT'],
      libro: ['SELECT', 'INSERT'],
      custodia: ['SELECT'],
      catalogo: ['SELECT'],
      control: [],
    },
    // El portero no trabaja por clase: por clase no tiene nada. Lo suyo es la
    // lista cerrada de abajo.
    coddvisor_portero: { raiz: [], negocio: [], libro: [], custodia: [], catalogo: [], control: [] },
  },

  // BD-16. Las únicas tablas que viven afuera de los negocios (clase control).
  // Cualquier otra tabla de control es una falta: entra a esta lista con su
  // porqué y lo aprueba el fundador (propuesta de identidad, decisión 14).
  tablasDeControl: [
    'control.acceso',
    'control.cuenta',
    'portero.llave',
  ],

  // Lista cerrada, tabla por tabla, para un rol que no trabaja por clase. Si
  // un rol está aquí, esta lista manda: una tabla que no figura no le da nada.
  permisosPorTabla: {
    coddvisor_portero: {
      'portero.llave': ['SELECT'],
    },
  },

  // Quién puede ejecutar cada función que corre con los permisos de su dueño
  // (SECURITY DEFINER). Cada una es una puerta: se abre con nombre y apellido.
  puertas: {
    'portero.contexto': ['coddvisor_app', 'coddvisor_libros'],
    'portero.abrir': ['coddvisor_app'],
    'portero.comprobar_firma': ['coddvisor_app'],
  },

  // Cómo entra el servicio a la base y de dónde sale el cliente activo.
  portero: {
    // Único rol que fija y lee el cliente activo. Nadie puede volverse él.
    rol: 'coddvisor_portero',
    // Roles con los que se conecta el servicio. Heredan de la aplicación, no
    // pueden cambiarse de rol y no son dueños de nada.
    entradas: ['coddvisor_entrada'],
    heredanDe: 'coddvisor_app',
    // De aquí leen las políticas y los sellos. El cuerpo de estas funciones es
    // el aislamiento: si cambia, cambia esta línea y lo aprueba el fundador.
    funciones: {
      'nucleo.tenant_actual': 'select (portero.contexto()).tenant_id',
      'nucleo.actor_actual': 'select (portero.contexto()).actor_id',
      'nucleo.dispositivo_actual': 'select (portero.contexto()).dispositivo_id',
    },
    // search_path de toda función que corre con los permisos de su dueño: el
    // esquema temporal va nombrado y al final, para que nada temporal se cuele.
    rutaDePuertas: 'search_path=pg_catalog, pg_temp',
  },

  // BD-04. La única política que admite una tabla de un cliente: la que pone
  // nucleo.preparar_tabla, para todos los roles y todas las órdenes, con este
  // filtro exacto tal como lo escribe Postgres (pg_get_expr). Cualquier otra
  // política, aunque nombre a nucleo.tenant_actual(), es una falta: basta una
  // permisiva como «nucleo.tenant_actual() is not null» para abrir todos los
  // negocios. Cambiar esto es cambiar la regla BD-04.
  aislamiento: {
    politica: 'aislamiento',
    filtroPorClase: {
      raiz: '(id = ( SELECT nucleo.tenant_actual() AS tenant_actual))',
      negocio: '(tenant_id = ( SELECT nucleo.tenant_actual() AS tenant_actual))',
      libro: '(tenant_id = ( SELECT nucleo.tenant_actual() AS tenant_actual))',
      custodia: '(tenant_id = ( SELECT nucleo.tenant_actual() AS tenant_actual))',
    },
  },

  // Cómo se llama una columna según lo que guarda.
  nombres: {
    largoMaximo: 48,
    prefijosDeBooleano: ['es_', 'esta_', 'tiene_', 'permite_', 'requiere_', 'usa_', 'incluye_'],
    // Palabras en singular que terminan en "s".
    singularesConS: ['pais', 'mes', 'interes', 'analisis', 'crisis', 'dosis', 'bonus', 'estatus'],
  },

  // Columnas que casi siempre guardan datos de una persona. Si una tabla usa
  // uno de estos nombres, su comentario debe decir [personal] o [sensible],
  // o [no personal] cuando de verdad no lo es.
  nombresDeDatoPersonal: [
    'celular', 'telefono', 'correo', 'email', 'numero_documento', 'fecha_nacimiento',
    'direccion', 'domicilio', 'sueldo', 'remuneracion', 'nombres', 'apellidos',
    'apellido_paterno', 'apellido_materno', 'cuenta_bancaria', 'foto', 'firma',
  ],

  // Largo mínimo de un comentario para que explique algo.
  comentarioMinimo: 12,

  // Lenguajes admitidos para funciones.
  lenguajes: ['sql', 'plpgsql'],
};
