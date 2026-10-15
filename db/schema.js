
import {
  mysqlTable,
  int,
  varchar,
  text,
  date,
  datetime,
  boolean,
} from "drizzle-orm/mysql-core";

// CONFIGURACIÓN DE CLAVES FORÁNEAS

const fkOptions = {
  onDelete: "no action",
  onUpdate: "no action",
};

// ==========================================
// INMOBILIARIAS
// ==========================================

export const inmobiliaria = mysqlTable("Inmobiliaria", {
  id: int("id").autoincrement().primaryKey(),
  nombre: varchar("Nombre", { length: 255 }),
  telefono: varchar("Teléfono", { length: 20 }),
  ubicacion: varchar("Ubicación", { length: 255 }),
});

// ==========================================
// CATÁLOGOS
// ==========================================

export const estadosComerciales = mysqlTable(
  "EstadosComerciales",
  {
    id: int("id").autoincrement().primaryKey(),
    nombre: varchar("Nombre", { length: 255 }),
  }
);

export const servicios = mysqlTable("Servicios", {
  id: int("id").autoincrement().primaryKey(),
  nombre: varchar("Nombre", { length: 255 }),
});

export const tiposNotificaciones = mysqlTable(
  "TiposNotificaciones",
  {
    id: int("id").autoincrement().primaryKey(),
    nombre: varchar("Nombre", { length: 255 }),
  }
);

export const roles = mysqlTable("Roles", {
  id: int("id").autoincrement().primaryKey(),
  nombre: varchar("Nombre", { length: 255 }),
});

export const estados = mysqlTable("Estados", {
  id: int("id").autoincrement().primaryKey(),
  nombre: varchar("Nombre", { length: 255 }),
});

export const categorias = mysqlTable("Categorías", {
  id: int("id").autoincrement().primaryKey(),
  nombre: varchar("Nombre", { length: 255 }),
});

export const tiposPropiedades = mysqlTable(
  "TiposPropiedades",
  {
    id: int("id").autoincrement().primaryKey(),
    nombre: varchar("Nombre", { length: 255 }),
  }
);

export const tiposParticipacion = mysqlTable(
  "TiposParticipacion",
  {
    id: int("id").autoincrement().primaryKey(),
    nombre: varchar("Nombre", { length: 255 }),
  }
);

export const estadosContratos = mysqlTable(
  "EstadosContratos",
  {
    id: int("id").autoincrement().primaryKey(),
    nombre: varchar("Nombre", { length: 255 })
      .notNull()
      .unique(),
  }
);

export const tiposContratos = mysqlTable(
  "TiposContratos",
  {
    id: int("id").autoincrement().primaryKey(),
    nombre: varchar("Nombre", { length: 255 })
      .notNull()
      .unique(),
  }
);

// ==========================================
// PERSONAS
// ==========================================

export const personas = mysqlTable("Personas", {
  id: int("id").autoincrement().primaryKey(),

  idInmobiliaria: int("id_inmobiliaria")
    .references(() => inmobiliaria.id, fkOptions),

  nombre: varchar("Nombre", { length: 255 }),
  apellido: varchar("Apellido", { length: 255 }),
  correo: varchar("Correo", { length: 255 }),
  dni: varchar("DNI", { length: 20 }),
  telefono: varchar("Teléfono", { length: 255 }),
  direccion: varchar("Dirección", { length: 255 }),
});

// ==========================================
// USUARIOS
// ==========================================

export const usuarios = mysqlTable("Usuarios", {
  id: int("id").autoincrement().primaryKey(),

  idPersona: int("id_persona")
    .notNull()
    .unique()
    .references(() => personas.id, fkOptions),

  usuario: varchar("Usuario", { length: 255 })
    .notNull()
    .unique(),

  password: varchar("Password", { length: 255 })
    .notNull(),

  idRol: int("id_rol")
    .notNull()
    .references(() => roles.id, fkOptions),
});

// ==========================================
// NOTIFICACIONES
// ==========================================

export const notificaciones = mysqlTable(
  "Notificaciones",
  {
    id: int("id").autoincrement().primaryKey(),

    idTipo: int("id_tipo")
      .references(() => tiposNotificaciones.id, fkOptions),

    titulo: varchar("Titulo", { length: 255 }),
    contenido: text("Contenido"),
  }
);

export const personasNotificaciones = mysqlTable(
  "personas_notificaciones",
  {
    id: int("id").autoincrement().primaryKey(),

    idPersona: int("id_persona")
      .notNull()
      .references(() => personas.id, fkOptions),

    idNotificacion: int("id_notificacion")
      .notNull()
      .references(() => notificaciones.id, fkOptions),

    leida: boolean("Leída")
      .notNull()
      .default(false),

    fechaLectura: datetime("Fecha_lectura", {
      mode: "string",
    }),
  }
);

// ==========================================
// PROPIEDADES
// ==========================================

export const propiedades = mysqlTable("Propiedades", {
  id: int("id").autoincrement().primaryKey(),

  idInmobiliaria: int("id_inmobiliaria")
    .references(() => inmobiliaria.id, fkOptions),

  idEstadoComercial: int("id_estadoComercial")
    .references(() => estadosComerciales.id, fkOptions),

  idTipo: int("id_tipo")
    .references(() => tiposPropiedades.id, fkOptions),

  nombre: varchar("Nombre", { length: 255 }),
  descripcion: text("Descripción"),
  ubicacion: varchar("Ubicación", { length: 255 }),
  precio: int("Precio"),
  tamano: int("Tamaño"),
  antiguedad: int("Antigüedad"),
});

// ==========================================
// PROPIEDADES - PERSONAS
// ==========================================

export const propiedadesPersonas = mysqlTable(
  "propiedades_personas",
  {
    id: int("id").autoincrement().primaryKey(),

    idPropiedad: int("id_propiedad")
      .notNull()
      .references(() => propiedades.id, fkOptions),

    idPersona: int("id_persona")
      .notNull()
      .references(() => personas.id, fkOptions),
  }
);

// ==========================================
// IMÁGENES DE PROPIEDADES
// ==========================================

export const propiedadesImagenes = mysqlTable(
  "propiedades_imagenes",
  {
    id: int("id").autoincrement().primaryKey(),

    idPropiedad: int("id_propiedad")
      .references(() => propiedades.id, fkOptions),

    nombre: varchar("Nombre", { length: 255 }),
  }
);

// ==========================================
// SERVICIOS DE PROPIEDADES
// ==========================================

export const propiedadesServicios = mysqlTable(
  "propiedades_servicios",
  {
    id: int("id").autoincrement().primaryKey(),

    idPropiedad: int("id_propiedad")
      .references(() => propiedades.id, fkOptions),

    idServicio: int("id_servicio")
      .references(() => servicios.id, fkOptions),

    activo: boolean("Activo"),
  }
);

// ==========================================
// CONTRATOS
// ==========================================

export const contratos = mysqlTable("Contratos", {
  id: int("id").autoincrement().primaryKey(),

  idTipoContrato: int("id_tipoContrato")
    .notNull()
    .references(() => tiposContratos.id, fkOptions),

  idEstadoContrato: int("id_estadoContrato")
    .notNull()
    .references(() => estadosContratos.id, fkOptions),

  idPropiedad: int("id_propiedad")
    .notNull()
    .references(() => propiedades.id, fkOptions),

  nombreDocumento: varchar("Nombre_documento", {
    length: 255,
  }),

  fechaFirma: date("Fecha_firma", {
    mode: "string",
  }),

  fechaInicio: date("Fecha_inicio", {
    mode: "string",
  }),

  fechaFin: date("Fecha_fin", {
    mode: "string",
  }),

  mesesDeAviso: int("Meses_de_aviso"),
  montoAcordado: int("Monto_acordado"),
});

// ==========================================
// CONTRATOS - PERSONAS
// ==========================================

export const contratosPersonas = mysqlTable(
  "contratos_personas",
  {
    id: int("id").autoincrement().primaryKey(),

    idContrato: int("id_contrato")
      .references(() => contratos.id, fkOptions),

    idPersona: int("id_persona")
      .references(() => personas.id, fkOptions),

    idTipoParticipacion: int("id_tipoParticipacion")
      .references(() => tiposParticipacion.id, fkOptions),
  }
);

// ==========================================
// VISITAS
// ==========================================

export const visitas = mysqlTable("Visitas", {
  id: int("id").autoincrement().primaryKey(),

  fecha: datetime("Fecha", {
    mode: "string",
  }),

  idPersona: int("id_persona")
    .references(() => personas.id, fkOptions),

  idPropiedad: int("id_propiedad")
    .references(() => propiedades.id, fkOptions),

  idEstado: int("id_estado")
    .references(() => estados.id, fkOptions),
});

// ==========================================
// REPORTES
// ==========================================

export const reportes = mysqlTable("Reportes", {
  id: int("id").autoincrement().primaryKey(),

  idPropiedad: int("id_propiedad")
    .references(() => propiedades.id, fkOptions),

  idCategoria: int("id_categoria")
    .references(() => categorias.id, fkOptions),

  titulo: varchar("Título", { length: 255 }),
  descripcion: text("Descripción"),

  fecha: date("Fecha", {
    mode: "string",
  }),
});

// ==========================================
// IMÁGENES DE REPORTES
// ==========================================

export const reportesImagenes = mysqlTable(
  "reportes_imagenes",
  {
    id: int("id").autoincrement().primaryKey(),

    idReporte: int("id_reporte")
      .references(() => reportes.id, fkOptions),

    nombre: varchar("Nombre", { length: 255 }),
  }
);

// ==========================================
// PROFESIONALES
// ==========================================

export const profesionales = mysqlTable(
  "Profesionales",
  {
    id: int("id").autoincrement().primaryKey(),

    idPersona: int("id_persona")
      .references(() => personas.id, fkOptions),

    profesion: varchar("Profesion", { length: 255 }),
  }
);
