const { z } = require("zod")

const vacioANulo = (valor) => typeof valor === "string" && valor.trim() === "" ? null : valor

const texto = (max) => z.string().trim().min(1).max(max)
const opcional = (reglas) => z.preprocess(vacioANulo, reglas.nullable().optional())

const actualizarPerfilSchema = z.object({
  nombre: texto(255).optional(),
  apellido: texto(255).optional(),
  telefono: opcional(z.string().trim().regex(/^[0-9+()\s-]{6,20}$/, "El teléfono solo puede tener números, espacios, +, - y paréntesis (6 a 20 caracteres)")),
  correo: opcional(z.string().trim().max(255).pipe(z.email("El correo no es válido"))),
  direccion: opcional(z.string().trim().max(255)),
  dni: opcional(z.string().trim().regex(/^\d{7,8}$/, "El DNI debe tener 7 u 8 números, sin puntos")),
}).strict().refine((cuerpo) => Object.keys(cuerpo).length > 0, {
  message: "Debe enviar al menos un campo para actualizar",
})

const nuevaContrasena = z.string()
  .min(8, "Debe tener al menos 8 caracteres")
  .regex(/[A-Z]/, "Debe tener al menos una letra mayúscula")
  .regex(/[a-z]/, "Debe tener al menos una letra minúscula")
  .regex(/[0-9]/, "Debe tener al menos un número")
  .refine((valor) => Buffer.byteLength(valor) <= 72, "Es demasiado larga")

const cambiarContrasenaSchema = z.object({
  actual: z.string().min(1).max(255),
  nueva: nuevaContrasena,
  confirmacion: z.string(),
}).strict()
  .refine((cuerpo) => cuerpo.confirmacion === cuerpo.nueva, {
    message: "Las contraseñas no coinciden",
    path: ["confirmacion"],
  })
  .refine((cuerpo) => cuerpo.nueva !== cuerpo.actual, {
    message: "La nueva contraseña debe ser distinta de la actual",
    path: ["nueva"],
  })

module.exports = { actualizarPerfilSchema, cambiarContrasenaSchema }
