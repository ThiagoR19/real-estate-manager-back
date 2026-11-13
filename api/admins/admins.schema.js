const { z } = require("zod")

const id = z.number().int().positive()
const idCoercible = z.coerce.number().int().positive()
const texto = (max) => z.string().trim().min(1).max(max)
const textoOpcional = (max) => z.preprocess((v) => typeof v === "string" && !v.trim() ? null : v, z.string().trim().max(max).nullable().optional())

const adminsQuerySchema = z.object({
  page: z.preprocess(
    (valor) => valor === "" ? undefined : valor,
    z.coerce.number().int().min(1).default(1)
  ),
  limit: z.preprocess(
    (valor) => valor === "" ? undefined : valor,
    z.coerce.number().int().min(1).max(10).default(10)
  ),
}).strict()

const crearAdminSchema = z.object({
  idInmobiliaria: id,
  nombre: texto(255).optional(),
  apellido: texto(255).optional(),
  correo: textoOpcional(255),
  dni: z.string().trim().regex(/^\d{7,8}$/, "El DNI debe tener 7 u 8 números"),
  telefono: textoOpcional(20),
  direccion: textoOpcional(255),
}).strict()

const idAdminSchema = z.object({
  id: idCoercible,
}).strict()

module.exports = { adminsQuerySchema, crearAdminSchema, idAdminSchema }
