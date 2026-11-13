const { z } = require("zod")

const vacioAIndefinido = (valor) => typeof valor === "string" && valor.trim() === "" ? undefined : valor

const sumarVisitaSchema = z.object({
  idInmobiliaria: z.number().int().positive().max(2147483647),
  token: z.string().trim().min(1).max(1000).optional(),
}).strict()

const visitasQuerySchema = z.object({
  desde: z.preprocess(vacioAIndefinido, z.iso.date().optional()),
  hasta: z.preprocess(vacioAIndefinido, z.iso.date().optional()),
}).strict().refine((query) => !query.desde || !query.hasta || query.desde <= query.hasta, {
  message: "La fecha desde no puede ser posterior a la fecha hasta",
  path: ["desde"],
})

module.exports = { sumarVisitaSchema, visitasQuerySchema }
