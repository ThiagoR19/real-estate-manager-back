const { z } = require("zod")

const id = z.number().int().positive()
const idCoercible = z.coerce.number().int().positive()
const texto = (max) => z.string().trim().min(1).max(max)
const textoOpcional = (max) => z.preprocess((v) => typeof v === "string" && !v.trim() ? null : v, z.string().trim().max(max).nullable().optional())

const numeroQuery = (reglas) => z.preprocess(
  (valor) => valor === "" ? undefined : valor,
  reglas.optional()
)

const propietariosQuerySchema = z.object({
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
    z.coerce.number().int().min(1).max(10).default(10)
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

const camposPersonaCrear = {
  nombre: texto(255).optional(),
  apellido: texto(255).optional(),
  correo: textoOpcional(255),
  dni: textoOpcional(20),
  telefono: textoOpcional(20),
  direccion: textoOpcional(255),
}

const camposPropietario = {
  cbu: textoOpcional(22),
  alias: textoOpcional(255),
  activo: z.boolean(),
}

const crearPropietarioSchema = z.object({
  idInmobiliaria: id.optional(),
  ...camposPersonaCrear,
  dni: z.string().trim().regex(/^\d{7,8}$/, "El DNI debe tener 7 u 8 números"),
  ...camposPropietario,
  activo: z.boolean().default(true),
}).strict()

const actualizarPropietarioSchema = z.object({
  ...camposPersona,
  nombre: texto(255).nullable().optional(),
  apellido: texto(255).nullable().optional(),
  dni: z.never().optional(),
  ...camposPropietario,
}).partial().strict().refine((cuerpo) => Object.keys(cuerpo).length > 0, {
  message: "Debe enviar al menos un campo para actualizar",
})

const idPropietarioSchema = z.object({
  id: idCoercible,
}).strict()

module.exports = { crearPropietarioSchema, actualizarPropietarioSchema, idPropietarioSchema, propietariosQuerySchema }
