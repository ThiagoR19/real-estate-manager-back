const { z } = require("zod")

const id = z.number().int().positive()
const idCoercible = z.coerce.number().int().positive()
const texto = (max) => z.string().trim().min(1).max(max)
const textoOpcional = (max) => z.string().trim().max(max).nullable().optional()

const numeroQuery = (reglas) => z.preprocess(
  (valor) => valor === "" ? undefined : valor,
  reglas.optional()
)

const agentesQuerySchema = z.object({
  idInmobiliaria: numeroQuery(idCoercible),
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

const camposPersona = {
  nombre: texto(255),
  apellido: texto(255),
  correo: textoOpcional(255),
  dni: textoOpcional(20),
  telefono: textoOpcional(20),
  direccion: textoOpcional(255),
}

const crearAgenteSchema = z.object({
  idInmobiliaria: id.optional(),
  ...camposPersona,
  usuario: texto(255),
  password: texto(255),
  idArea: id.nullable().optional().default(null),
}).strict()

const actualizarAgenteSchema = z.object({
  ...camposPersona,
  usuario: texto(255),
  password: texto(255),
  idArea: id.nullable().optional(),
}).partial().strict().refine((cuerpo) => Object.keys(cuerpo).length > 0, {
  message: "Debe enviar al menos un campo para actualizar",
})

const idAgenteSchema = z.object({
  id: idCoercible,
}).strict()

const rolAgenteSchema = z.object({
  rol: z.preprocess(
    (valor) => typeof valor === "string" ? valor.toUpperCase() : valor,
    z.enum(["ADMIN", "AGENTE"])
  ),
}).strict()

module.exports = {
  crearAgenteSchema,
  actualizarAgenteSchema,
  idAgenteSchema,
  rolAgenteSchema,
  agentesQuerySchema,
}
