const { z } = require("zod")

const texto = (max) => z.string().trim().min(1).max(max)

const codigoActivacionSchema = z.object({
  codigo: texto(255),
}).strict()

const verificarDniSchema = z.object({
  dni: z.string().trim().regex(/^\d{7,8}$/, "El DNI debe tener 7 u 8 números"),
}).strict()

const loginSchema = z.object({
  usuario: texto(255),
  password: texto(255),
}).strict()

const registroSchema = z.object({
  verificacion: texto(2048),
  usuario: texto(255),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres")
    .regex(/[A-Z]/, "La contraseña debe incluir una mayúscula")
    .regex(/[a-z]/, "La contraseña debe incluir una minúscula")
    .regex(/[0-9]/, "La contraseña debe incluir un número")
    .refine((valor) => Buffer.byteLength(valor) <= 72, "La contraseña es demasiado larga"),
}).strict()

module.exports = { codigoActivacionSchema, verificarDniSchema, loginSchema, registroSchema }
