const { z } = require("zod")

const idInmobiliariaSchema = z.object({
  id: z.coerce.number().int().positive().max(2147483647),
}).strict()

// Cantidad de propiedades para la landing: 6 por defecto, hasta 12
const propiedadesQuerySchema = z.object({
  limit: z.preprocess(
    (valor) => valor === "" ? undefined : valor,
    z.coerce.number().int().min(1).max(12).default(6)
  ),
}).strict()

module.exports = { idInmobiliariaSchema, propiedadesQuerySchema }
