const { z } = require("zod")

const id = z.coerce.number().int().positive()
const texto = (max) => z.string().trim().min(1).max(max)
const textoOpcional = (max) => z.preprocess((v) => typeof v === "string" && !v.trim() ? null : v, z.string().trim().max(max).nullable().optional())

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

const crearInquilinoSchema = z.object({
  ...datosPersona,
  nombre: texto(255).optional(),
  apellido: texto(255).optional(),
  dni: z.string().trim().regex(/^\d{7,8}$/, "El DNI debe tener 7 u 8 números"),
}).strict()

const actualizarInquilinoSchema = z.object({
  ...datosPersona,
  nombre: texto(255).nullable().optional(),
  apellido: texto(255).nullable().optional(),
  dni: z.never().optional(),
  activo: z.boolean(),
  idPropiedad: id,
}).partial().strict().refine((cuerpo) => Object.keys(cuerpo).length > 0, {
  message: "Debe enviar al menos un campo para actualizar",
})

const idInquilinoSchema = z.object({
  id,
}).strict()

const inquilinosQuerySchema = z.object(paginacion).strict()

module.exports = { crearInquilinoSchema, actualizarInquilinoSchema, idInquilinoSchema, inquilinosQuerySchema }
