const bcrypt = require("bcrypt")
const crypto = require("crypto")
const db = require("../../db/conexion")
const { crearTokenS } = require("../../utils/token")
const { hashearToken } = require("../../utils/activacion")
const { saltRounds } = require("../../config/env")

function problema(codigo, mensaje) {
  const error = new Error(mensaje || "")
  error.codigo = codigo
  return error
}

async function activarCuenta(codigo, passwordHash) {
  const conexion = await db.getConnection()

  try {
    await conexion.beginTransaction()

    const [filas] = await conexion.execute(
      `SELECT
         ta.id AS idToken,
         u.id AS idUsuario,
         u.usuario,
         u.idRol,
         p.nombre,
         p.apellido,
         p.idInmobiliaria AS idInmobi
       FROM tokensAcceso ta
       INNER JOIN usuarios u ON u.id = ta.idUsuario
       INNER JOIN personas p
         ON p.id = u.idPersona
         AND (p.idInmobiliaria <=> u.idInmobiliaria)
       WHERE ta.tokenHash = ?
         AND ta.proposito = 'ACTIVACION'
         AND ta.fechaUso IS NULL
         AND ta.fechaExpiracion > CURRENT_TIMESTAMP
         AND u.fechaActivacion IS NULL
       FOR UPDATE`,
      [hashearToken(codigo)]
    )

    if (!filas.length) {
      await conexion.rollback()
      return null
    }

    const cuenta = filas[0]
    await conexion.execute(
      `UPDATE usuarios
       SET passwordHash = ?,
           fechaActivacion = COALESCE(fechaActivacion, CURRENT_TIMESTAMP)
       WHERE id = ?`,
      [passwordHash, cuenta.idUsuario]
    )
    await conexion.execute(
      `UPDATE tokensAcceso
       SET fechaUso = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [cuenta.idToken]
    )

    await conexion.commit()
    return cuenta
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}

async function buscarCuenta(usuario) {
  const [filas] = await db.execute(
    `SELECT
       u.id AS idUsuario,
       u.usuario,
       u.passwordHash,
       CASE
         WHEN u.fechaActivacion IS NULL THEN 'PENDIENTE_ACTIVACION'
         ELSE 'ACTIVO'
       END AS estado,
       u.idRol,
       p.nombre,
       p.apellido,
       p.idInmobiliaria AS idInmobi
     FROM usuarios u
     INNER JOIN personas p
       ON p.id = u.idPersona
       AND (p.idInmobiliaria <=> u.idInmobiliaria)
     WHERE u.usuario = ?
     LIMIT 1`,
    [usuario]
  )
  return filas[0] || null
}

async function activar(codigo, cuerpo = {}) {
  const passwordHash = await bcrypt.hash(cuerpo.password, saltRounds)
  const cuenta = await activarCuenta(codigo, passwordHash)

  if (!cuenta) {
    throw problema("INVITACION_INVALIDA", "La invitación no existe, expiró o ya fue utilizada")
  }

  return {
    token: crearTokenS(cuenta.nombre, cuenta.apellido, cuenta.idRol, cuenta.idUsuario, cuenta.idInmobi),
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

async function login(cuerpo = {}) {
  const cuenta = await buscarCuenta(cuerpo.usuario)
  const passwordCorrecta = cuenta && cuenta.passwordHash
    ? await bcrypt.compare(cuerpo.password, cuenta.passwordHash)
    : false

  if (!passwordCorrecta) throw problema("CREDENCIALES_INVALIDAS")
  if (cuenta.estado === "PENDIENTE_ACTIVACION") throw problema("CUENTA_NO_ACTIVADA")
  if (cuenta.estado !== "ACTIVO") throw problema("CUENTA_DESACTIVADA")

  await db.execute(
    "UPDATE usuarios SET ultimoAcceso = CURRENT_TIMESTAMP WHERE id = ?",
    [cuenta.idUsuario]
  )

  return {
    token: crearTokenS(cuenta.nombre, cuenta.apellido, cuenta.idRol, cuenta.idUsuario, cuenta.idInmobi),
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

async function logout(usuario, token) {
  const datos = require("../../utils/token").verificarToken(token)
  if (!datos || !datos.exp) throw problema("TOKEN_INVALIDO")
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex")
  await db.execute("DELETE FROM sesionesRevocadas WHERE fechaExpiracion <= CURRENT_TIMESTAMP")
  await db.execute(
    `INSERT INTO sesionesRevocadas (tokenHash, idUsuario, fechaExpiracion)
     VALUES (?, ?, FROM_UNIXTIME(?))
     ON DUPLICATE KEY UPDATE fechaExpiracion = VALUES(fechaExpiracion)`,
    [tokenHash, usuario.id, datos.exp]
  )
}

module.exports = { activar, login, logout }
