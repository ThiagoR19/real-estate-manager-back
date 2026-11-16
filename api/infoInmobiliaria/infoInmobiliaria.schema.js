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

const vacioComoNada = (schema) => z.preprocess((valor) => valor === "" ? undefined : valor, schema.optional())

const catalogoQuerySchema = z.object({
  operacion: vacioComoNada(z.enum(["Venta", "Alquiler"])),
  ubicacion: vacioComoNada(z.string().trim().max(100)),
  tipo: vacioComoNada(z.string().max(200)),
  moneda: vacioComoNada(z.enum(["ARS", "USD"])),
  precioMin: vacioComoNada(z.coerce.number().min(0)),
  precioMax: vacioComoNada(z.coerce.number().min(0)),
  habitaciones: vacioComoNada(z.enum(["1", "2", "3", "4+"])),
  orden: vacioComoNada(z.enum(["recientes", "menorPrecio", "mayorPrecio"])),
  pagina: vacioComoNada(z.coerce.number().int().min(1)),
  limite: vacioComoNada(z.coerce.number().int().min(1).max(24)),
}).strict()

const idPropiedadSchema = z.object({
  id: z.coerce.number().int().positive().max(2147483647),
  idPropiedad: z.coerce.number().int().positive().max(2147483647),
}).strict()

module.exports = { idInmobiliariaSchema, propiedadesQuerySchema, catalogoQuerySchema, idPropiedadSchema }
