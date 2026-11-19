const { z } = require("zod")

const vacioAIndefinido = (valor) => typeof valor === "string" && valor.trim() === "" ? undefined : valor
const vacioANulo = (valor) => typeof valor === "string" && valor.trim() === "" ? null : valor

const ESTADOS = ["Pendiente", "En revision", "Aprobado", "Rechazado", "Anulado"]
const MEDIOS = ["TRANSFERENCIA", "EFECTIVO", "OTRO"]

const id = z.coerce.number().int().positive().max(2147483647)
const fecha = z.iso.date()
const periodo = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use el formato AAAA-MM")
const dosDecimales = (valor) => Math.abs(Math.round(valor * 100) - valor * 100) < 1e-6
const monto = z.number().min(0).max(9999999999.99).refine(dosDecimales, "Admite hasta 2 decimales")
const detalle = z.preprocess(vacioANulo, z.string().trim().max(255).nullable().optional())

const conceptos = z.array(z.object({ idConcepto: id, monto }).strict()).min(1).max(30)
  .refine((lista) => new Set(lista.map((concepto) => concepto.idConcepto)).size === lista.length, "Hay conceptos repetidos")

const crearPagoSchema = z.object({
  idContrato: id,
  periodo,
  fechaVencimiento: fecha.optional(),
  detalle,
  conceptos,
}).strict()

const modificarPagoSchema = z.object({
  fechaVencimiento: fecha,
  detalle,
  conceptos,
}).strict()

const marcarPagadoSchema = z.object({
  medioPago: z.enum(MEDIOS).optional(),
}).strict()

const cargarComprobanteQuerySchema = z.object({
  enviar: z.literal("1").optional(),
})

const motivoPagoSchema = z.object({
  motivo: z.string().trim().min(3).max(500),
}).strict()

const comprobanteEnRevision = z.number().int().positive().max(2147483647).optional()
const aprobarPagoSchema = marcarPagadoSchema.extend({ idComprobante: comprobanteEnRevision })
const rechazarPagoSchema = motivoPagoSchema.extend({ idComprobante: comprobanteEnRevision })

const crearConceptoSchema = z.object({
  nombre: z.string().trim().min(1).max(255),
  descripcion: z.preprocess(vacioANulo, z.string().trim().max(255).nullable().optional()),
}).strict()

const idPagoSchema = z.object({ id }).strict()

const registrarPagoParamsSchema = z.object({ idContrato: id, periodo }).strict()

const prepararPagoSchema = z.object({
  idContrato: id,
  periodo,
}).strict()

const personasQuerySchema = z.object({
  q: z.preprocess(vacioAIndefinido, z.string().trim().max(100).optional()),
}).strict()

const pagosQuerySchema = z.object({
  idContrato: z.preprocess(vacioAIndefinido, id.optional()),
  estado: z.preprocess(vacioAIndefinido, z.enum(ESTADOS).optional()),
  anio: z.preprocess(vacioAIndefinido, z.coerce.number().int().min(2000).max(2100).optional()),
  page: z.preprocess(vacioAIndefinido, z.coerce.number().int().min(1).max(1000000).default(1)),
  limit: z.preprocess(vacioAIndefinido, z.coerce.number().int().min(1).max(12).default(12)),
}).strict()

module.exports = {
  crearPagoSchema,
  modificarPagoSchema,
  marcarPagadoSchema,
  cargarComprobanteQuerySchema,
  motivoPagoSchema,
  aprobarPagoSchema,
  rechazarPagoSchema,
  crearConceptoSchema,
  idPagoSchema,
  registrarPagoParamsSchema,
  prepararPagoSchema,
  personasQuerySchema,
  pagosQuerySchema,
}
