const { z } = require("zod")

const id = z.number().int().positive()
const idCoercible = z.coerce.number().int().positive()
const texto = (max) => z.string().trim().min(1).max(max)
const textoOpcional = (max) => z.string().trim().max(max).nullable().optional()

const numeroQuery = (reglas) => z.preprocess(
  (valor) => valor === "" ? undefined : valor,
  reglas.optional()
)

const profesionalQuerySchema = z.object({
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

const crearProfesionalSchema = z.object({
  idInmobiliaria: id.optional(),
  idPersona: id.optional(),
  ...camposPersonaCrear,
  profesion: texto(255),
}).strict().refine((cuerpo) => cuerpo.idPersona !== undefined || (cuerpo.nombre && cuerpo.apellido), {
  message: "Debe indicar idPersona o los datos de la persona",
  path: ["idPersona"],
})

const actualizarProfesionalSchema = z.object({
  ...camposPersona,
  dni: z.never().optional(),
  profesion: texto(255),
}).partial().strict().refine((cuerpo) => Object.keys(cuerpo).length > 0, {
  message: "Debe enviar al menos un campo para actualizar",
})

const idProfesionalSchema = z.object({
  id: idCoercible,
}).strict()

const valorarProfesionalSchema = z.object({ puntuacion: z.number().int().min(1).max(5) }).strict()

module.exports = { crearProfesionalSchema, actualizarProfesionalSchema, idProfesionalSchema, profesionalQuerySchema, valorarProfesionalSchema }
