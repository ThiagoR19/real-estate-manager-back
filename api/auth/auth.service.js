const bcrypt = require("bcrypt")
const repository = require("./auth.repository")
const AppError = require("../../utils/app-error")
const { crearTokenS } = require("../../utils/token")
const { validarCodigo, validarActivacion, validarLogin } = require("./auth.validation")

const SALT_ROUNDS = Number(process.env.SALT_ROUNDS) || 10

async function activar(codigo, cuerpo) {
  const codigoValidado = validarCodigo(codigo)
  const datos = validarActivacion(cuerpo)
  const passwordHash = await bcrypt.hash(datos.password, SALT_ROUNDS)
  const cuenta = await repository.activarCuenta(codigoValidado, passwordHash)

  if (!cuenta) {
    throw new AppError("INVITACION_INVALIDA", "La invitación no existe, expiró o ya fue utilizada")
  }

  const token = crearTokenS(
    cuenta.nombre,
    cuenta.apellido,
    cuenta.idRol,
    cuenta.idUsuario,
    cuenta.idInmobi
  )

  return {
    token,
    usuario: {
      id: cuenta.idUsuario,
      usuario: cuenta.usuario,
      nombre: cuenta.nombre,
      apellido: cuenta.apellido,
      rol: cuenta.idRol,
      idInmobi: cuenta.idInmobi,
      estado: "ACTIVO",
    },
  }
}

async function login(cuerpo) {
  const datos = validarLogin(cuerpo)
  const cuenta = await repository.buscarPorUsuario(datos.usuario)
  const passwordValida = cuenta && cuenta.passwordHash
    ? await bcrypt.compare(datos.password, cuenta.passwordHash)
    : false

  if (!passwordValida) {
    throw new AppError("CREDENCIALES_INVALIDAS")
  }

  if (cuenta.estado === "PENDIENTE_ACTIVACION") {
    throw new AppError("CUENTA_NO_ACTIVADA")
  }

  if (cuenta.estado !== "ACTIVO") {
    throw new AppError("CUENTA_DESACTIVADA")
  }

  await repository.registrarAcceso(cuenta.idUsuario)

  return {
    token: crearTokenS(
      cuenta.nombre,
      cuenta.apellido,
      cuenta.idRol,
      cuenta.idUsuario,
      cuenta.idInmobi
    ),
    usuario: {
      id: cuenta.idUsuario,
      usuario: cuenta.usuario,
      nombre: cuenta.nombre,
      apellido: cuenta.apellido,
      rol: cuenta.idRol,
      idInmobi: cuenta.idInmobi,
      estado: cuenta.estado,
    },
  }
}

module.exports = { activar, login }
