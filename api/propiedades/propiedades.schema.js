const { z } = require("zod")

const id = z.number().int().positive()
const textoOpcional = (max) => z.string().trim().max(max).nullable().optional()
const numeroOpcional = (reglas) => reglas.nullable().optional()

const propiedadCampos = {
  idEstadoComercial: id,
  idTipo: id,
  idAgente: numeroOpcional(id),
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
    z.coerce.number().int().min(1).max(100).default(20)
  ),
}).strict()

module.exports = { crearPropiedadSchema, actualizarPropiedadSchema, idPropiedadSchema, propiedadesQuerySchema, }
