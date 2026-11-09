const { z } = require("zod")

const texto = (max) => z.string().trim().min(1).max(max)
const textoOpcional = (max) => z.union([
  z.string().trim().max(max),
  z.null(),
])

const actualizarPerfilSchema = z.object({
  nombre: texto(255),
  apellido: texto(255),
  correo: textoOpcional(255),
  dni: textoOpcional(20),
  telefono: textoOpcional(20),
  direccion: textoOpcional(255),
  passwordActual: z.string().min(1).optional(),
  passwordNueva: z.string().min(8).max(255).optional(),
}).strict().refine((cuerpo) => Boolean(cuerpo.passwordActual) === Boolean(cuerpo.passwordNueva), {
  message: "Para cambiar la contraseña debe enviar la contraseña actual y la nueva",
})

module.exports = { actualizarPerfilSchema }
