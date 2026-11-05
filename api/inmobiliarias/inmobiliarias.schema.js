const { z } = require("zod")

const vacioANulo = (valor) => typeof valor === "string" && valor.trim() === "" ? null : valor
const vacioAIndefinido = (valor) => valor === "" ? undefined : valor

const nombre = z.string().trim().min(1).max(255)
const textoOpcional = (max) => z.preprocess(
  vacioANulo,
  z.string().trim().max(max).nullable().optional()
)

const crearInmobiliariaSchema = z.object({
  nombre,
}).strict()

const editarInmobiliariaSchema = z.object({
  nombre,
  telefono: textoOpcional(20),
  ubicacion: textoOpcional(255),
  dominio: textoOpcional(255),
}).strict()

const idInmobiliariaSchema = z.object({
  id: z.coerce.number().int().positive().max(2147483647),
}).strict()

const inmobiliariasQuerySchema = z.object({
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
  crearInmobiliariaSchema,
  editarInmobiliariaSchema,
  idInmobiliariaSchema,
  inmobiliariasQuerySchema,
}
