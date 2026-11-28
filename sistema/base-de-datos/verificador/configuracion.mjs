// Lo que el verificador necesita saber y no puede leer de la base.
// Cambiar algo aquí es cambiar una regla: va con su explicación en
// arquitectura/bases/02-base-de-datos.md y lo aprueba el fundador.

export const configuracion = {
  // Qué puede hacer cada rol de la aplicación según la clase de la tabla.
  // Nadie tiene DELETE ni TRUNCATE: en Coddvisor nada se borra.
  // custodia: datos de un cliente que la aplicación solo lee y que escribe una
  // sola puerta (la membresía y sus roles). Por clase nadie escribe en ella.
  // comun: datos de todos, que no son de ningún negocio (la comunidad). La
  // aplicación solo los lee; los escriben las puertas firmadas de su módulo
  // (cambio de BD-05 del 27-nov-2026, etapa 1 de la comunidad).
  permisos: {
    coddvisor_app: {
      raiz: ['SELECT'],
      negocio: ['SELECT', 'INSERT', 'UPDATE'],
      libro: ['SELECT'],
      custodia: ['SELECT'],
      catalogo: ['SELECT'],
      control: [],
      comun: ['SELECT'],
    },
    coddvisor_libros: {
      raiz: ['SELECT'],
      negocio: ['SELECT'],
      libro: ['SELECT', 'INSERT'],
      custodia: ['SELECT'],
      catalogo: ['SELECT'],
      control: [],
      // Los libros son de los negocios: lo de la comunidad no les hace falta.
      comun: [],
    },
    // El portero no trabaja por clase: por clase no tiene nada. Lo suyo es la
    // lista cerrada de abajo.
    coddvisor_portero: { raiz: [], negocio: [], libro: [], custodia: [], catalogo: [], control: [], comun: [] },
    // El dueño de las puertas de identidad, igual: por clase nada, y su lista
    // cerrada abajo (cambio de BD-05 del 26-nov-2026, tramo 2a de identidad).
    coddvisor_identidad: { raiz: [], negocio: [], libro: [], custodia: [], catalogo: [], control: [], comun: [] },
    // El dueño de las puertas de la comunidad: por clase nada, y su lista cerrada
    // abajo (cambio de BD-05 del 27-nov-2026, etapa 1 de la comunidad).
    coddvisor_comunidad: { raiz: [], negocio: [], libro: [], custodia: [], catalogo: [], control: [], comun: [] },
  },

  // BD-16. Las únicas tablas que viven afuera de los negocios (clase control).
  // Cualquier otra tabla de control es una falta: entra a esta lista con su
  // porqué y lo aprueba el fundador (propuesta de identidad, decisión 14).
  tablasDeControl: [
    'control.acceso',
    'control.cuenta',
    'portero.llave',
    // No guarda filas: el portero la traba al abrir un negocio para saber que ya
    // abrió uno aunque se borre la tabla del contexto. Va afuera porque no es de
    // ningún negocio (tramo 2b de identidad, auditoría de seguridad).
    'portero.marca',
    // En qué celda vive cada negocio y con qué nombre se muestra al elegir a
    // cuál entrar, sin abrirlo (propuesta de identidad, decisión 14: «la lista
    // de en qué celda vive cada negocio»). Tramo 3 de identidad, parte 1.
    'control.negocio',
    // Las sesiones que la persona cerró al salir, que el servicio consulta en
    // cada pedido (propuesta de identidad, decisión 5: «una lista de sesiones
    // cerradas»). Es de la cuenta, no de un negocio. Tramo 3 de identidad, parte 2.
    'control.sesion_cerrada',
    // Los permisos de alta que anota el botón «Abra su negocio» y que lee el
    // gancho de Supabase Auth antes de crear una cuenta con Google (propuesta de
    // identidad, decisión 8 bis). Son de una persona que todavía no tiene cuenta
    // ni negocio. Barrera de altas, 26-nov-2026.
    'control.alta_permitida',
    // Las migraciones que el migrador aplicó a la base, con su huella (decisión
    // D24: las migraciones solo desde la revisión automática). Es de la base
    // entera, no de un negocio. Camino de las migraciones, 26-nov-2026.
    'control.migracion_aplicada',
    // Lo usado de cada cupo compartido (intentos fallidos, permisos de alta),
    // por la huella de su clave y por ventana de tiempo: la IP, el correo o la
    // sesión que se cuentan todavía no tienen negocio, o no se sabe de cuál son.
    // Va en la base porque es lo único que ven todas las copias de la función
    // (plan de despliegue, paso 22; decisión 8 bis). Cupos compartidos, 27-nov-2026.
    'control.cupo_usado',
  ],

  // BD-16. La segunda lista de afuera: las tablas de clase comun, que son de
  // todos y no de un negocio (la comunidad). Toda tabla común figura aquí y vive
  // en su esquema; una que no figure es una falta. Entra con su porqué y lo
  // aprueba el fundador (comunidad-etapa-1.md, «Lo que la clase comun exige»).
  tablasComunes: [
    // Cómo se presenta cada persona: nombre de pila, rol y negocio descrito.
    // Es de la persona y se muestra a todos, sin entrar a ningún negocio.
    'comunidad.perfil',
    // Cuántos perfiles vivos comparten cada descripción, en cada escalón: la
    // proyección con que la descripción se achica. Se lee al mostrar.
    'comunidad.conteo_descripcion',
  ],
  esquemaDeLoComun: 'comunidad',

  // BD-03. Lo único del plano de control que una tabla común puede citar con una
  // clave foránea: la cuenta de la persona. Así la comunidad no llega a las
  // llaves, al índice de accesos ni a la lista de negocios.
  controlQueCitaLoComun: ['control.cuenta'],

  // Lista cerrada, tabla por tabla, para un rol que no trabaja por clase. Si
  // un rol está aquí, esta lista manda: una tabla que no figura no le da nada.
  permisosPorTabla: {
    // Lee la llave para verificar firmas y, desde el tramo 2b de identidad, la
    // membresía, sus roles y sus permisos para comprobar quién entra. Solo lee, y
    // solo lo del negocio que acaba de abrir: la seguridad por fila vale para él
    // (cambio de BD-05 del 26-nov-2026, tramo 2b de identidad).
    coddvisor_portero: {
      'portero.llave': ['SELECT'],
      // Solo para trabarla en modo access share, que pide SELECT y nada más.
      'portero.marca': ['SELECT'],
      'identidad.membresia': ['SELECT'],
      'identidad.asignacion': ['SELECT'],
      'identidad.rol': ['SELECT'],
      'identidad.permiso_de_rol': ['SELECT'],
    },
    // Lo justo para sus puertas: registrar cuentas, fundar un negocio (la raíz
    // y sus membresías), escribir membresías y asignaciones, y copiar el estado
    // al índice. Lee los roles y sus permisos para comprobar el de quien actúa.
    // Desde el 26-nov-2026 (abrir un negocio, decisión 10 de identidad) crea y
    // lee también la primera empresa y el primer local de un negocio que abre, y
    // lee el país y sus regímenes. Nunca los edita. Ninguna otra tabla de negocio.
    coddvisor_identidad: {
      'nucleo.tenant': ['SELECT', 'INSERT'],
      'nucleo.empresa': ['SELECT', 'INSERT'],
      'nucleo.establecimiento': ['SELECT', 'INSERT'],
      'nucleo.pais': ['SELECT'],
      'nucleo.regimen_tributario': ['SELECT'],
      'control.cuenta': ['SELECT', 'INSERT'],
      'control.acceso': ['SELECT', 'INSERT', 'UPDATE'],
      // Fundar copia el nombre y la celda; listar los negocios los lee (tramo 3).
      'control.negocio': ['SELECT', 'INSERT'],
      // Salir anota la sesión; cada pedido la lee. Solo se anexa (tramo 3, parte 2).
      'control.sesion_cerrada': ['SELECT', 'INSERT'],
      'identidad.membresia': ['SELECT', 'INSERT', 'UPDATE'],
      'identidad.asignacion': ['SELECT', 'INSERT', 'UPDATE'],
      'identidad.rol': ['SELECT'],
      'identidad.permiso_de_rol': ['SELECT'],
      // El registro de entradas: solo anexa, por su puerta (tramo 2b).
      'identidad.entrada': ['SELECT', 'INSERT'],
      // El botón «Abra su negocio» anota un permiso de alta y el gancho de
      // Supabase Auth lo lee. Solo se anexa (barrera de altas, decisión 8 bis).
      'control.alta_permitida': ['SELECT', 'INSERT'],
      // Los cupos compartidos: la puerta lee los topes y suma lo usado en la
      // fila de cada ventana (cupos compartidos, 27-nov-2026).
      'identidad.tope_de_cupo': ['SELECT'],
      'control.cupo_usado': ['SELECT', 'INSERT', 'UPDATE'],
    },
    // Lo justo para las puertas de la comunidad: escribir el perfil y su
    // proyección, y leer los catálogos con que se cuenta (el rubro amplio, los
    // escalones y los ajustes). Ninguna tabla de un negocio y nada del plano de
    // control: de una cuenta solo sabe si está activa, por identidad.cuenta_activa
    // (cambio de BD-05 del 27-nov-2026, etapa 1 de la comunidad).
    coddvisor_comunidad: {
      'comunidad.perfil': ['SELECT', 'INSERT', 'UPDATE'],
      'comunidad.conteo_descripcion': ['SELECT', 'INSERT', 'UPDATE'],
      'comunidad.rubro': ['SELECT'],
      'comunidad.escalon': ['SELECT'],
      'comunidad.ajuste': ['SELECT'],
    },
  },

  // Quién puede ejecutar cada función que corre con los permisos de su dueño
  // (SECURITY DEFINER). Cada una es una puerta: se abre con nombre y apellido.
  puertas: {
    // Las puertas de la comunidad lo leen a través de los sellos y para comprobar
    // que no hay un negocio abierto (etapa 1 de la comunidad).
    'portero.contexto': ['coddvisor_app', 'coddvisor_libros', 'coddvisor_identidad', 'coddvisor_comunidad'],
    // Las formas del portero (tramo 2b de identidad). portero.abrir queda para
    // la caja sola; la persona entra por abrir_persona, que comprueba la membresía.
    'portero.abrir': ['coddvisor_app'],
    'portero.abrir_persona': ['coddvisor_app'],
    'portero.abrir_caja_con_vendedor': ['coddvisor_app'],
    // Solo sirve con una llave de uso «trabajos»: la del servicio no la firma.
    'portero.abrir_trabajo': ['coddvisor_app'],
    'portero.comprobar_firma': ['coddvisor_app'],
    'portero.comprobar_firma_de_trabajos': ['coddvisor_app'],
    // Las puertas de identidad abren ellas mismas, mientras escriben, el negocio
    // que fundan o cuya invitación se acepta, y le piden al portero que verifique
    // su firma.
    'portero.poner': ['coddvisor_identidad'],
    // Y lo vuelven a cerrar antes de terminar: nunca dejan un negocio abierto.
    'portero.quitar': ['coddvisor_identidad'],
    'portero.exigir_firma_de_identidad': ['coddvisor_identidad'],
    // El registro de entradas verifica con la llave del programa que anota: la de
    // los trabajos para las entradas automáticas, la del servicio para las demás.
    'portero.exigir_firma_de_identidad_con_llave': ['coddvisor_identidad'],
    // Las puertas de identidad: solo el servicio, cada una con su firma.
    'identidad.registrar_cuenta': ['coddvisor_app'],
    'identidad.leer_acceso': ['coddvisor_app'],
    'identidad.fundar_negocio': ['coddvisor_app'],
    'identidad.invitar': ['coddvisor_app'],
    'identidad.aceptar_invitacion': ['coddvisor_app'],
    'identidad.cambiar_estado': ['coddvisor_app'],
    'identidad.dar_asignacion': ['coddvisor_app'],
    'identidad.archivar_asignacion': ['coddvisor_app'],
    'identidad.registrar_entrada': ['coddvisor_app'],
    // Para entrar (tramo 3, parte 1): la cuenta de un pase y sus negocios.
    'identidad.leer_cuenta': ['coddvisor_app'],
    'identidad.listar_negocios': ['coddvisor_app'],
    // Salir de verdad (tramo 3, parte 2): anotar la sesión cerrada y leer la
    // cuenta con su sesión en cada pedido.
    'identidad.cerrar_sesion': ['coddvisor_app'],
    'identidad.leer_cuenta_de_sesion': ['coddvisor_app'],
    // Abrir un negocio con su primera empresa, su local y su rubro (26-nov-2026).
    'identidad.abrir_negocio': ['coddvisor_app'],
    // La barrera de altas (decisión 8 bis, 26-nov-2026): el servicio anota el
    // permiso, y el gancho lo ejecuta Supabase Auth con su propio rol, el único
    // de esta lista que no es de Coddvisor. Ese rol no recibe ninguna tabla.
    'identidad.permitir_alta': ['coddvisor_app'],
    'ganchos.antes_de_crear_cuenta': ['supabase_auth_admin'],
    // Los cupos compartidos de intentos y de permisos de alta (27-nov-2026).
    'identidad.usar_cupos': ['coddvisor_app'],
    // La única que anexa el rubro elegido. Es del rol de los libros y solo la
    // ejecuta la puerta que abre un negocio, dentro del negocio que abrió.
    'configuracion.anotar_rubro': ['coddvisor_identidad'],
    // La comunidad (etapa 1, 27-nov-2026). Sus puertas las ejecuta solo el
    // servicio, cada una con su firma, que verifica el portero solo para
    // propósitos «comunidad_». De una cuenta, la comunidad sabe solo si está activa.
    'portero.exigir_firma_de_comunidad': ['coddvisor_comunidad'],
    'identidad.cuenta_activa': ['coddvisor_comunidad'],
    'comunidad.crear_perfil': ['coddvisor_app'],
    'comunidad.cambiar_perfil': ['coddvisor_app'],
    'comunidad.archivar_perfil': ['coddvisor_app'],
    'comunidad.olvidar_perfil': ['coddvisor_app'],
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
