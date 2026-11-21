// Lo que el verificador necesita saber y no puede leer de la base.
// Cambiar algo aquí es cambiar una regla: va con su explicación en
// arquitectura/bases/02-base-de-datos.md y lo aprueba el fundador.

export const configuracion = {
  // Qué puede hacer cada rol de la aplicación según la clase de la tabla.
  // Nadie tiene DELETE ni TRUNCATE: en Coddvisor nada se borra.
  permisos: {
    coddvisor_app: {
      raiz: ['SELECT'],
      negocio: ['SELECT', 'INSERT', 'UPDATE'],
      libro: ['SELECT'],
      catalogo: ['SELECT'],
      control: [],
    },
    coddvisor_libros: {
      raiz: ['SELECT'],
      negocio: ['SELECT'],
      libro: ['SELECT', 'INSERT'],
      catalogo: ['SELECT'],
      control: [],
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
