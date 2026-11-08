const { z } = require("zod")

const vacioAIndefinido = (valor) => typeof valor === "string" && valor.trim() === "" ? undefined : valor

const ANIO_MINIMO = 2000
const anioMaximo = () => new Date().getFullYear() + 1

const anio = z.number().int().min(ANIO_MINIMO).refine((valor) => valor <= anioMaximo(), "El año no puede ser posterior al próximo")

const tieneHastaCuatroDecimales = (valor) => Math.abs(Math.round(valor * 10000) - valor * 10000) < 1e-6

const crearIndecSchema = z.object({
  anio,
  mes: z.number().int().min(1).max(12),
  porcentaje: z.number()
    .gt(-100, "El porcentaje debe ser mayor a -100")
    .max(100, "El porcentaje no puede superar 100")
    .refine(tieneHastaCuatroDecimales, "El porcentaje admite hasta 4 decimales"),
}).strict()

const indecQuerySchema = z.object({
  anio: z.preprocess(vacioAIndefinido, z.coerce.number().pipe(anio).optional()),
}).strict()

module.exports = { crearIndecSchema, indecQuerySchema }
