const { z } = require("zod")

const id = z.number().int().positive()
const idCoercible = z.coerce.number().int().positive()
const texto = (max) => z.string().trim().min(1).max(max)
const textoOpcional = (max) => z.string().trim().max(max).nullable().optional()
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener formato YYYY-MM-DD")

const numeroQuery = (reglas) => z.preprocess(
  (valor) => valor === "" ? undefined : valor,
  reglas.optional()
)

const reportesQuerySchema = z.object({
  idInmobiliaria: numeroQuery(idCoercible),
  q: z.preprocess(
    (valor) => valor === "" ? undefined : valor,
    z.string().trim().max(255).optional()
  ),
  page: z.preprocess(
    (valor) => valor === "" ? undefined : valor,
    z.coerce.number().int().min(1).default(1)
  ),
  limit: z.preprocess(
    (valor) => valor === "" ? undefined : valor,
    z.coerce.number().int().min(1).max(100).default(20)
  ),
}).strict()

const camposReporte = {
  idPropiedad: id,
  idCategoria: id,
  idEstado: id,
  idProfesional: id.nullable().optional(),
  prioridad: z.enum(["BAJA", "MEDIA", "ALTA", "URGENTE"]),
  titulo: texto(255),
  descripcion: textoOpcional(65535),
  fecha,
}

const crearReporteSchema = z.object({
  idInmobiliaria: id.optional(),
  idPersonaReporta: id.optional(),
  ...camposReporte,
  prioridad: z.enum(["BAJA", "MEDIA", "ALTA", "URGENTE"]).default("MEDIA"),
}).strict()

const actualizarReporteSchema = z.object(camposReporte)
  .partial()
  .strict()
  .refine((cuerpo) => Object.keys(cuerpo).length > 0, {
    message: "Debe enviar al menos un campo para actualizar",
  })

const idReporteSchema = z.object({
  id: idCoercible,
}).strict()

module.exports = {
  crearReporteSchema,
  actualizarReporteSchema,
  idReporteSchema,
  reportesQuerySchema,
}
