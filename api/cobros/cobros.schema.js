const { z } = require("zod")

const vacioAIndefinido = (valor) => typeof valor === "string" && valor.trim() === "" ? undefined : valor
const vacioANulo = (valor) => typeof valor === "string" && valor.trim() === "" ? null : valor

const ESTADOS = ["Pendiente", "Liquidado", "Anulado"]

const id = z.coerce.number().int().positive().max(2147483647)
const periodo = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use el formato AAAA-MM")
const dosDecimales = (valor) => Math.abs(Math.round(valor * 100) - valor * 100) < 1e-6
const monto = z.number().min(-9999999999.99).max(9999999999.99).refine(dosDecimales, "Admite hasta 2 decimales")
const comision = z.number().min(0).max(9999999999.99).refine(dosDecimales, "Admite hasta 2 decimales")

const datosDelCobro = {
  porcentajeComision: z.number().min(0).max(100).optional(),
  comision: comision.optional(),
  detalle: z.preprocess(vacioANulo, z.string().trim().max(255).nullable().optional()),
  conceptos: z.array(z.object({ idConcepto: id, monto }).strict()).min(1).max(30)
    .refine((lista) => new Set(lista.map((concepto) => concepto.idConcepto)).size === lista.length, "Hay conceptos repetidos"),
}

const unaComision = (cuerpo) => cuerpo.porcentajeComision === undefined || cuerpo.comision === undefined
const mensajeComision = { message: "Envíe el porcentaje o el monto de la comisión, no ambos", path: ["comision"] }

const crearCobroSchema = z.object({
  idPago: id,
  idPropietario: id,
  ...datosDelCobro,
}).strict().refine(unaComision, mensajeComision)

const modificarCobroSchema = z.object(datosDelCobro).strict().refine(unaComision, mensajeComision)

const idCobroSchema = z.object({ id }).strict()

const prepararCobroSchema = z.object({
  idContrato: id,
  idPropietario: id,
  periodo,
}).strict()

const personasQuerySchema = z.object({
  q: z.preprocess(vacioAIndefinido, z.string().trim().max(100).optional()),
}).strict()

const cobrosQuerySchema = z.object({
  idPropietario: z.preprocess(vacioAIndefinido, id.optional()),
  idContrato: z.preprocess(vacioAIndefinido, id.optional()),
  estado: z.preprocess(vacioAIndefinido, z.enum(ESTADOS).optional()),
  anio: z.preprocess(vacioAIndefinido, z.coerce.number().int().min(2000).max(2100).optional()),
  page: z.preprocess(vacioAIndefinido, z.coerce.number().int().min(1).max(1000000).default(1)),
  limit: z.preprocess(vacioAIndefinido, z.coerce.number().int().min(1).max(12).default(12)),
}).strict()

module.exports = {
  crearCobroSchema,
  modificarCobroSchema,
  idCobroSchema,
  prepararCobroSchema,
  personasQuerySchema,
  cobrosQuerySchema,
}
