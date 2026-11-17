const { z } = require("zod")

const id = z.number().int().positive()
const textoOpcional = (max) => z.string().trim().max(max).nullable().optional()
const numeroOpcional = (reglas) => reglas.nullable().optional()

const propiedadCampos = {
  idEstadoComercial: id,
  idTipo: id,
  idAgente: numeroOpcional(id),
  idPropietario: numeroOpcional(id),
  servicios: z.array(id).max(50).refine((ids) => new Set(ids).size === ids.length, "No repita servicios").optional(),
  datosContrato: z.object({
    fechaInicio: z.iso.date().nullable(),
    fechaFin: z.iso.date().nullable(),
    mesesAumento: z.number().int().min(1).max(120).nullable(),
    tipo: z.enum(["Alquiler", "Venta"]),
    estado: z.enum(["Borrador", "Vigente", "Finalizado"]),
    montoInicial: z.number().min(0).max(9999999999.99).nullable(),
    tipoAumento: z.enum(["FIJO", "INDEC"]).nullable(),
    aumentoFijo: z.number().min(0).max(9999999999.99).nullable(),
  }).strict().superRefine((datos, contexto) => {
    if (datos.fechaInicio && datos.fechaFin && datos.fechaFin < datos.fechaInicio) {
      contexto.addIssue({ code: "custom", path: ["fechaFin"], message: "La fecha de fin debe ser posterior al inicio" })
    }
    if (datos.tipoAumento === "FIJO" && (!datos.aumentoFijo || !datos.mesesAumento)) {
      contexto.addIssue({ code: "custom", path: ["aumentoFijo"], message: "El aumento fijo necesita monto y frecuencia" })
    }
    if (datos.tipoAumento !== "FIJO" && datos.aumentoFijo) {
      contexto.addIssue({ code: "custom", path: ["aumentoFijo"], message: "Este tipo de aumento no lleva monto fijo" })
    }
  }).nullable().optional(),
  nombre: z.string().trim().min(1).max(255),
  descripcion: textoOpcional(65535),
  ubicacion: textoOpcional(255),
  precio: numeroOpcional(z.number().min(0).max(9999999999.99)),
  moneda: z.enum(["ARS", "USD"]),
  publicada: z.boolean(),
  tamano: numeroOpcional(z.number().gt(0).max(99999999.99)),
  antiguedad: numeroOpcional(z.number().int().min(0)),
  banos: numeroOpcional(z.number().int().min(0)),
  habitaciones: numeroOpcional(z.number().int().min(0)),
}

const crearPropiedadSchema = z.object({
  idInmobiliaria: id.optional(),
  ...propiedadCampos,
  moneda: z.enum(["ARS", "USD"]).default("ARS"),
  publicada: z.boolean().default(false),
}).strict()

const actualizarPropiedadSchema = z.object(propiedadCampos)
  .partial()
  .strict()
  .refine((cuerpo) => Object.keys(cuerpo).length > 0, {
    message: "Debe enviar al menos un campo para actualizar",
  })

const idPropiedadSchema = z.object({
  id: z.coerce.number().int().positive(),
}).strict()

const numeroQuery = (reglas) => z.preprocess(
  (valor) => valor === "" ? undefined : valor,
  reglas.optional()
)

const propiedadesQuerySchema = z.object({
  idInmobiliaria: numeroQuery(z.coerce.number().int().positive()),
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
    z.coerce.number().int().min(1).max(12).default(12)
  ),
}).strict()

module.exports = { crearPropiedadSchema, actualizarPropiedadSchema, idPropiedadSchema, propiedadesQuerySchema, }
