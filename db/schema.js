
import {
  mysqlTable,
  int,
  varchar,
  text,
  date,
  boolean,
} from "drizzle-orm/mysql-core";

const fkOptions = {
  onDelete: "no action",
  onUpdate: "no action",
};

// CATÁLOGOS

export const estadosComerciales = mysqlTable("EstadosComerciales", {
  id: int("id").autoincrement().primaryKey(),
  nombre: varchar("Nombre", { length: 255 }),
});

export const inmobiliaria = mysqlTable("Inmobiliaria", {
  id: int("id").autoincrement().primaryKey(),
  nombre: varchar("Nombre", { length: 255 }),
  telefono: int("Teléfono"),
  ubicacion: varchar("Ubicación", { length: 255 }),
});

export const servicios = mysqlTable("Servicios", {
  id: int("id").autoincrement().primaryKey(),
  nombre: varchar("Nombre", { length: 255 }),
});

export const tiposNotificaciones = mysqlTable("TiposNotificaciones", {
  id: int("id").autoincrement().primaryKey(),
  nombre: varchar("Nombre", { length: 255 }),
});

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

export const tiposPropiedades = mysqlTable("TiposPropiedades", {
  id: int("id").autoincrement().primaryKey(),
  nombre: varchar("Nombre", { length: 255 }),
});

// PERSONAS Y USUARIOS

export const personas = mysqlTable("Personas", {
  id: int("id").autoincrement().primaryKey(),
  idInmobiliaria: int("id_inmobiliaria")
    .references(() => inmobiliaria.id, fkOptions),
  nombre: varchar("Nombre", { length: 255 }),
  apellido: varchar("Apellido", { length: 255 }),
  correo: varchar("Correo", { length: 255 }),
  dni: int("DNI"),
  telefono: int("Teléfono"),
  direccion: varchar("Dirección", { length: 255 }),
});

export const usuarios = mysqlTable("Usuarios", {
  id: int("id").autoincrement().primaryKey(),
  idPersona: int("id_persona")
    .references(() => personas.id, fkOptions),
  usuario: varchar("Usuario", { length: 255 }),
  password: varchar("Password", { length: 255 }),
});

// NOTIFICACIONES

export const notificaciones = mysqlTable("Notificaciones", {
  id: int("id").autoincrement().primaryKey(),
  idTipo: int("id_tipo")
    .references(() => tiposNotificaciones.id, fkOptions),
  titulo: varchar("Titulo", { length: 255 }),
  contenido: text("Contenido"),
});

export const personasNotificaciones = mysqlTable("personas_notificaciones", {
  id: int("id").autoincrement().primaryKey(),
  idPersona: int("id_persona")
    .references(() => personas.id, fkOptions),
  idNotificacion: int("id_notificacion")
    .references(() => notificaciones.id, fkOptions),
});

// PROPIEDADES

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

export const propiedadesPersonas = mysqlTable("propiedades_personas", {
  id: int("id").autoincrement().primaryKey(),
  idPropiedad: int("id_propiedad")
    .references(() => propiedades.id, fkOptions),
  idPersona: int("id_persona")
    .references(() => personas.id, fkOptions),
  idRol: int("id_rol")
    .references(() => roles.id, fkOptions),
});

export const propiedadesImagenes = mysqlTable("propieades_imagenes", {
  id: int("id").autoincrement().primaryKey(),
  idPropiedad: int("id_propiedad")
    .references(() => propiedades.id, fkOptions),
  nombre: varchar("Nombre", { length: 255 }),
});

export const propiedadesServicios = mysqlTable("propiedades_servicios", {
  id: int("id").autoincrement().primaryKey(),
  idPropiedad: int("id_propiedad")
    .references(() => propiedades.id, fkOptions),
  idServicio: int("id_servicio")
    .references(() => servicios.id, fkOptions),
  activo: boolean("Activo"),
});

// CONTRATOS, VISITAS Y REPORTES

export const contratos = mysqlTable("Contratos", {
  id: int("id").autoincrement().primaryKey(),
  nombreDocumento: varchar("Nombre_documento", { length: 255 }),
  idPropiedad: int("id_propiedad")
    .references(() => propiedades.id, fkOptions),
  idAgente: int("id_agente"),
  fechaInicio: date("Fecha_inicio", { mode: "string" }),
  fechaFin: date("Fecha_fin", { mode: "string" }),
  mesesDeAviso: int("MesesDeAviso"),
});

export const visitas = mysqlTable("Visitas", {
  id: int("id").autoincrement().primaryKey(),
  fecha: date("Fecha", { mode: "string" }),
  idPersona: int("id_persona")
    .references(() => personas.id, fkOptions),
  idPropiedad: int("id_propiedad")
    .references(() => propiedades.id, fkOptions),
  idEstado: int("id_estado")
    .references(() => estados.id, fkOptions),
});

export const reportes = mysqlTable("Reportes", {
  id: int("id").autoincrement().primaryKey(),
  idPropiedad: int("id_propiedad")
    .references(() => propiedades.id, fkOptions),
  idCategoria: int("id_categoria")
    .references(() => categorias.id, fkOptions),
  titulo: varchar("Título", { length: 255 }),
  descripcion: text("Descripción"),
  fecha: date("Fecha", { mode: "string" }),
});

export const reportesImagenes = mysqlTable("reportes_imagenes", {
  id: int("id").autoincrement().primaryKey(),
  idReporte: int("id_reporte")
    .references(() => reportes.id, fkOptions),
  nombre: varchar("Nombre", { length: 255 }),
});

// PROFESIONALES

export const profesionales = mysqlTable("Profesionales", {
  id: int("id").autoincrement().primaryKey(),
  idPersona: int("id_persona")
    .references(() => personas.id, fkOptions),
  profesion: varchar("Profesion", { length: 255 }),
});
