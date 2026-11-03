const AppError = require("../../utils/app-error")

function error(mensaje) {
  return new AppError("DATOS_INVALIDOS", mensaje)
}

function validarCuerpo(cuerpo) {
  if (!cuerpo || typeof cuerpo !== "object" || Array.isArray(cuerpo)) {
    throw error("El cuerpo de la petición debe ser un objeto")
  }
}

function validarPassword(password) {
  if (typeof password !== "string" || password.length < 8) {
    throw error('El campo "password" debe tener al menos 8 caracteres')
  }

  return password
}

function validarCodigo(codigo) {
  if (typeof codigo !== "string" || !/^[a-f0-9]{64}$/i.test(codigo)) {
    throw new AppError("INVITACION_INVALIDA", "La invitación no es válida")
  }

  return codigo
}

function validarActivacion(cuerpo) {
  validarCuerpo(cuerpo)
  return { password: validarPassword(cuerpo.password) }
}

function validarLogin(cuerpo) {
  validarCuerpo(cuerpo)

  if (typeof cuerpo.usuario !== "string" || !cuerpo.usuario.trim()) {
    throw error('El campo "usuario" es obligatorio')
  }

  return {
    usuario: cuerpo.usuario.trim(),
    password: validarPassword(cuerpo.password),
  }
}

module.exports = {
  validarCodigo,
  validarActivacion,
  validarLogin,
}
