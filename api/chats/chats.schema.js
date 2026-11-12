const { z } = require("zod")

const vacioAIndefinido = (valor) => typeof valor === "string" && valor.trim() === "" ? undefined : valor

const id = z.coerce.number().int().positive().max(2147483647)
const contenido = z.string().trim().min(1).max(5000)
const busqueda = z.preprocess(vacioAIndefinido, z.string().trim().min(1).max(100).optional())

const idConversacionSchema = z.object({
  id,
}).strict()

const idAdjuntoSchema = z.object({
  id,
  idAdjunto: id,
}).strict()

const iniciarConversacionSchema = z.object({
  idUsuario: id,
  mensaje: contenido,
}).strict()

const enviarMensajeSchema = z.object({
  contenido: z.preprocess(vacioAIndefinido, contenido.optional()),
}).strict()

const conversacionesQuerySchema = z.object({
  q: busqueda,
}).strict()

const contactosQuerySchema = z.object({
  q: busqueda,
}).strict()

const historialQuerySchema = z.object({
  page: z.preprocess(
    vacioAIndefinido,
    z.coerce.number().int().min(1).max(1000000).default(1)
  ),
  limit: z.preprocess(
    vacioAIndefinido,
    z.coerce.number().int().min(1).max(10).default(10)
  ),
}).strict()

const buscarQuerySchema = z.object({
  q: busqueda,
  fecha: z.preprocess(vacioAIndefinido, z.iso.date().optional()),
}).strict().refine((filtros) => filtros.q || filtros.fecha, {
  message: "Debe enviar un texto o una fecha para buscar",
})

module.exports = { idConversacionSchema, idAdjuntoSchema, iniciarConversacionSchema, enviarMensajeSchema, conversacionesQuerySchema, contactosQuerySchema, historialQuerySchema, buscarQuerySchema }
