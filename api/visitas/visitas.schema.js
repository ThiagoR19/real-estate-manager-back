const { z } = require("zod")

const vacioAIndefinido = (valor) => typeof valor === "string" && valor.trim() === "" ? undefined : valor

const id = z.coerce.number().int().positive().max(2147483647)
const idQuery = z.preprocess(vacioAIndefinido, id.optional())
const fecha = z.iso.datetime({ offset: true }).transform((valor) => new Date(valor))
const limiteDia = z.union([z.iso.date(), z.iso.datetime({ offset: true })])

const idVisitaSchema = z.object({
  id,
}).strict()

const programarVisitaSchema = z.object({
  idCliente: id,
  idPropiedad: id,
  idAgente: id.optional(),
  fecha,
}).strict()

const modificarVisitaSchema = z.object({
  idCliente: id,
  idPropiedad: id,
  idAgente: id,
  fecha,
  estado: z.enum(["Programada", "Realizada"]),
}).strict()

const cancelarVisitaSchema = z.object({
  motivo: z.string().trim().min(1).max(500),
  confirmacion: z.literal(true),
}).strict()

const visitasQuerySchema = z.object({
  desde: z.preprocess(vacioAIndefinido, limiteDia.optional()),
  hasta: z.preprocess(vacioAIndefinido, limiteDia.optional()),
  idAgente: idQuery,
  idCliente: idQuery,
  idPropiedad: idQuery,
  estado: z.preprocess(vacioAIndefinido, z.enum(["Programada", "Realizada", "Cancelada"]).optional()),
  page: z.preprocess(
    vacioAIndefinido,
    z.coerce.number().int().min(1).max(1000000).default(1)
  ),
  limit: z.preprocess(
    vacioAIndefinido,
    z.coerce.number().int().min(1).max(100).default(20)
  ),
}).strict()

module.exports = {
  idVisitaSchema,
  programarVisitaSchema,
  modificarVisitaSchema,
  cancelarVisitaSchema,
  visitasQuerySchema,
}
