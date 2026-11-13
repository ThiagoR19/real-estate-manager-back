const bcrypt = require("bcrypt")
const crypto = require("crypto")
const jwt = require("jsonwebtoken")
const db = require("../../db/conexion")
const { crearTokenS } = require("../../utils/token")
const { hashearToken } = require("../../utils/activacion")
const { saltRounds, jwtSecret } = require("../../config/env")

function problema(codigo, mensaje) {
  const error = new Error(mensaje || "")
  error.codigo = codigo
  return error
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

async function verificarDni(codigo, dni) {
  const conexion = await db.getConnection()
  try {
    await conexion.beginTransaction()
    const [filas] = await conexion.execute(
      `SELECT ta.id AS idToken, ta.intentosDni, u.id AS idUsuario, p.dni
       FROM tokensAcceso ta
       INNER JOIN usuarios u ON u.id = ta.idUsuario
       INNER JOIN personas p ON p.id = u.idPersona
         AND (p.idInmobiliaria <=> u.idInmobiliaria)
       WHERE ta.tokenHash = ? AND ta.proposito = 'ACTIVACION'
         AND ta.fechaUso IS NULL AND ta.fechaExpiracion > CURRENT_TIMESTAMP
         AND u.fechaActivacion IS NULL
       FOR UPDATE`,
      [hashearToken(codigo)]
    )
    if (!filas.length) {
      await conexion.rollback()
      return { error: "INVITACION_INVALIDA", mensaje: "La invitación no existe, expiró o ya fue utilizada" }
    }
    const cuenta = filas[0]
    if (cuenta.intentosDni >= 3) {
      await conexion.rollback()
      return { error: "INVITACION_INVALIDA", mensaje: "Se agotaron los intentos de verificación. Pedí otro enlace a la inmobiliaria." }
    }
    if (cuenta.dni !== dni) {
      const intentos = cuenta.intentosDni + 1
      await conexion.execute(
        `UPDATE tokensAcceso SET intentosDni = ?, fechaUso = IF(? >= 3, CURRENT_TIMESTAMP, fechaUso) WHERE id = ?`,
        [intentos, intentos, cuenta.idToken]
      )
      await conexion.commit()
      return { error: "DATOS_INVALIDOS", mensaje: intentos >= 3
        ? "Se agotaron los intentos de verificación. Pedí otro enlace a la inmobiliaria."
        : `El DNI no coincide. Quedan ${3 - intentos} intentos.` }
    }
    await conexion.commit()
    return { verificacion: jwt.sign({ tipo: "VerificacionDni", idUsuario: cuenta.idUsuario, tokenHash: hashearToken(codigo) }, jwtSecret, { expiresIn: "15m" }) }
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}

async function registrar({ verificacion, usuario, password }) {
  let comprobante
  try { comprobante = jwt.verify(verificacion, jwtSecret) } catch { /* Caducó o fue alterado. */ }
  if (comprobante?.tipo !== "VerificacionDni") {
    return { error: "INVITACION_INVALIDA", mensaje: "Verificá nuevamente tu DNI desde el enlace de invitación." }
  }
  const conexion = await db.getConnection()
  try {
    await conexion.beginTransaction()
    const [filas] = await conexion.execute(
      `SELECT ta.id AS idToken, u.id AS idUsuario, u.idRol, p.nombre, p.apellido,
              p.idInmobiliaria AS idInmobi
       FROM tokensAcceso ta
       INNER JOIN usuarios u ON u.id = ta.idUsuario
       INNER JOIN personas p ON p.id = u.idPersona
         AND (p.idInmobiliaria <=> u.idInmobiliaria)
       WHERE ta.tokenHash = ? AND ta.idUsuario = ? AND ta.proposito = 'ACTIVACION'
         AND ta.fechaUso IS NULL AND ta.fechaExpiracion > CURRENT_TIMESTAMP
         AND ta.intentosDni < 3 AND u.fechaActivacion IS NULL
       FOR UPDATE`,
      [comprobante.tokenHash, comprobante.idUsuario]
    )
    if (!filas.length) {
      await conexion.rollback()
      return { error: "INVITACION_INVALIDA", mensaje: "La invitación no existe, expiró o ya fue utilizada" }
    }
    const [ocupados] = await conexion.execute("SELECT id FROM usuarios WHERE usuario = ? AND id <> ? LIMIT 1", [usuario, comprobante.idUsuario])
    if (ocupados.length) {
      await conexion.rollback()
      return { error: "CONFLICTO", mensaje: "El nombre de usuario ya está en uso" }
    }
    const cuenta = filas[0]
    const passwordHash = await bcrypt.hash(password, saltRounds)
    await conexion.execute(
      `UPDATE usuarios SET usuario = ?, passwordHash = ?, fechaActivacion = CURRENT_TIMESTAMP WHERE id = ? AND fechaActivacion IS NULL`,
      [usuario, passwordHash, cuenta.idUsuario]
    )
    await conexion.execute("UPDATE tokensAcceso SET fechaUso = CURRENT_TIMESTAMP WHERE id = ?", [cuenta.idToken])
    await conexion.commit()
    return {
      token: crearTokenS(cuenta.nombre, cuenta.apellido, cuenta.idRol, cuenta.idUsuario, cuenta.idInmobi),
      usuario: {
        id: cuenta.idUsuario, usuario, nombre: cuenta.nombre,
        apellido: cuenta.apellido, rol: cuenta.idRol, idInmobi: cuenta.idInmobi, estado: "ACTIVO",
      },
    }
  } catch (error) {
    await conexion.rollback()
    if (error.code === "ER_DUP_ENTRY") return { error: "CONFLICTO", mensaje: "El nombre de usuario ya está en uso" }
    throw error
  } finally {
    conexion.release()
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

module.exports = { verificarDni, registrar, login, logout }
