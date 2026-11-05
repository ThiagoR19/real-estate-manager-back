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

module.exports = { codigoActivacionSchema, activarSchema, loginSchema }
