const { z } = require("zod")

const texto = (max) => z.string().trim().min(1).max(max)

const codigoActivacionSchema = z.object({
  codigo: texto(255),
}).strict()

const activarSchema = z.object({
  password: texto(255),
}).strict()

const loginSchema = z.object({
  usuario: texto(255),
  password: texto(255),
}).strict()

const registroSchema = z.object({
  codigo: z.string().regex(/^[a-f0-9]{64}$/i),
  correo: z.email().max(255),
  password: z.string().min(8).max(255),
  dni: z.string().regex(/^\d{7,8}$/, "El DNI debe tener 7 u 8 números"),
}).strict()

module.exports = { codigoActivacionSchema, activarSchema, loginSchema, registroSchema }
