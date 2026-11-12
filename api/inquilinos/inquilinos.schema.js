const { z } = require("zod")

const id = z.coerce.number().int().positive()
const texto = (max) => z.string().trim().min(1).max(max)
const textoOpcional = (max) => z.string().trim().max(max).nullable().optional()

const paginacion = {
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
}

const datosPersona = {
  nombre: texto(255),
  apellido: texto(255),
  correo: textoOpcional(255),
  dni: textoOpcional(20),
  telefono: textoOpcional(20),
  direccion: textoOpcional(255),
}

const credenciales = {
  usuario: texto(255),
  password: texto(255),
}

const crearInquilinoSchema = z.object({
  ...datosPersona,
  ...credenciales,
}).strict()

const actualizarInquilinoSchema = z.object({
  ...datosPersona,
  ...credenciales,
  activo: z.boolean(),
}).partial().strict().refine((cuerpo) => Object.keys(cuerpo).length > 0, {
  message: "Debe enviar al menos un campo para actualizar",
})

const idInquilinoSchema = z.object({
  id,
}).strict()

const inquilinosQuerySchema = z.object(paginacion).strict()

module.exports = { crearInquilinoSchema, actualizarInquilinoSchema, idInquilinoSchema, inquilinosQuerySchema }
