const { z } = require("zod")

const vacioAIndefinido = (valor) => typeof valor === "string" && valor.trim() === "" ? undefined : valor

const id = z.coerce.number().int().positive().max(2147483647)
const contenido = z.string().trim().min(1).max(5000)
const busqueda = z.preprocess(vacioAIndefinido, z.string().trim().min(1).max(100).optional())

const idConversacionSchema = z.object({
  id,
}).strict()

const iniciarConversacionSchema = z.object({
  idUsuario: id,
  mensaje: contenido,
}).strict()

const enviarMensajeSchema = z.object({
  contenido,
}).strict()

const conversacionesQuerySchema = z.object({
  q: busqueda,
}).strict()

const contactosQuerySchema = z.object({
  q: busqueda,
}).strict()

const buscarQuerySchema = z.object({
  q: busqueda,
  fecha: z.preprocess(vacioAIndefinido, z.iso.date().optional()),
}).strict().refine((filtros) => filtros.q || filtros.fecha, {
  message: "Debe enviar un texto o una fecha para buscar",
})

module.exports = { idConversacionSchema, iniciarConversacionSchema, enviarMensajeSchema, conversacionesQuerySchema, contactosQuerySchema, buscarQuerySchema }
