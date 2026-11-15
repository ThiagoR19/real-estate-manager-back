const bcrypt = require("bcrypt")
const crypto = require("crypto")
const jwt = require("jsonwebtoken")
const db = require("../../db/conexion")
const { crearTokenS } = require("../../utils/token")
const { hashearToken } = require("../../utils/activacion")
const { saltRounds, jwtSecret } = require("../../config/env")
const { verificarGoogle } = require("../../utils/google")

function problema(codigo, mensaje) {
  const error = new Error(mensaje || "")
  error.codigo = codigo
  return error
}

async function buscarCuentas(usuario) {
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
       p.idInmobiliaria AS idInmobi,
       i.nombre AS inmobiliaria
     FROM usuarios u
     INNER JOIN personas p
       ON p.id = u.idPersona
       AND (p.idInmobiliaria <=> u.idInmobiliaria)
     LEFT JOIN inmobiliaria i ON i.id = u.idInmobiliaria
     WHERE u.usuario = ?`,
    [usuario]
  )
  return filas
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
    const cuenta = filas[0]
    const [ocupados] = await conexion.execute(
      "SELECT id FROM usuarios WHERE usuario = ? AND (idInmobiliaria <=> ?) AND id <> ? LIMIT 1",
      [usuario, cuenta.idInmobi, comprobante.idUsuario]
    )
    if (ocupados.length) {
      await conexion.rollback()
      return { error: "CONFLICTO", mensaje: "El nombre de usuario ya está en uso" }
    }
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

function sesion(cuenta) {
  return {
    token: crearTokenS(cuenta.nombre, cuenta.apellido, cuenta.idRol, cuenta.idUsuario, cuenta.idInmobi),
    usuario: {
      id: cuenta.idUsuario, usuario: cuenta.usuario, nombre: cuenta.nombre,
      apellido: cuenta.apellido, rol: cuenta.idRol, idInmobi: cuenta.idInmobi, estado: "ACTIVO",
    },
  }
}

function baseUsuario(nombre) {
  return (nombre || "usuario").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 230) || "usuario"
}

async function registrarGoogle({ verificacion, credential }) {
  let comprobante
  try { comprobante = jwt.verify(verificacion, jwtSecret) } catch { /* Expiró. */ }
  if (comprobante?.tipo !== "VerificacionDni") {
    return { error: "INVITACION_INVALIDA", mensaje: "Verificá nuevamente tu DNI desde el enlace de invitación." }
  }
  const google = await verificarGoogle(credential)
  const conexion = await db.getConnection()
  try {
    await conexion.beginTransaction()
    const [filas] = await conexion.execute(
      `SELECT ta.id AS idToken, u.id AS idUsuario, u.idRol, u.idInmobiliaria,
              p.nombre, p.apellido, p.correo, p.idInmobiliaria AS idInmobi
       FROM tokensAcceso ta
       INNER JOIN usuarios u ON u.id = ta.idUsuario
       INNER JOIN personas p ON p.id = u.idPersona AND (p.idInmobiliaria <=> u.idInmobiliaria)
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
    const cuenta = filas[0]
    if (cuenta.correo && (!google.email_verified || cuenta.correo.toLowerCase() !== google.email?.toLowerCase())) {
      await conexion.rollback()
      return { error: "DATOS_INVALIDOS", mensaje: "El correo de Google no coincide con el registrado. Pedí a la inmobiliaria que lo revise." }
    }
    const [vinculados] = await conexion.execute(
      "SELECT id FROM usuarios WHERE googleSub = ? AND (idInmobiliaria <=> ?) LIMIT 1",
      [google.sub, cuenta.idInmobiliaria]
    )
    if (vinculados.length) {
      await conexion.rollback()
      return { error: "CONFLICTO", mensaje: "Esta cuenta de Google ya está vinculada en esta inmobiliaria" }
    }
    const base = baseUsuario(google.name || `${cuenta.nombre || ""}${cuenta.apellido || ""}`)
    let usuario = base
    for (let numero = 1; numero < 1000; numero++) {
      const [ocupados] = await conexion.execute(
        "SELECT id FROM usuarios WHERE usuario = ? AND (idInmobiliaria <=> ?) LIMIT 1",
        [usuario, cuenta.idInmobiliaria]
      )
      if (!ocupados.length) break
      usuario = `${base}${numero + 1}`
    }
    await conexion.execute(
      "UPDATE usuarios SET usuario = ?, googleSub = ?, passwordHash = NULL, fechaActivacion = CURRENT_TIMESTAMP WHERE id = ? AND fechaActivacion IS NULL",
      [usuario, google.sub, cuenta.idUsuario]
    )
    await conexion.execute("UPDATE tokensAcceso SET fechaUso = CURRENT_TIMESTAMP WHERE id = ?", [cuenta.idToken])
    await conexion.commit()
    return sesion({ ...cuenta, usuario })
  } catch (error) {
    await conexion.rollback()
    if (error.code === "ER_DUP_ENTRY") return { error: "CONFLICTO", mensaje: "La cuenta de Google o el usuario ya están en uso" }
    throw error
  } finally {
    conexion.release()
  }
}

async function loginGoogle({ credential, idUsuario }) {
  const google = await verificarGoogle(credential)
  const [cuentas] = await db.execute(
    `SELECT u.id AS idUsuario, u.usuario, u.idRol, u.fechaActivacion,
            p.nombre, p.apellido, p.idInmobiliaria AS idInmobi,
            i.nombre AS inmobiliaria
     FROM usuarios u
     INNER JOIN personas p ON p.id = u.idPersona AND (p.idInmobiliaria <=> u.idInmobiliaria)
     LEFT JOIN inmobiliaria i ON i.id = u.idInmobiliaria
     WHERE u.googleSub = ? AND u.fechaActivacion IS NOT NULL`,
    [google.sub]
  )
  if (!cuentas.length) throw problema("CREDENCIALES_INVALIDAS", "Esta cuenta de Google no está vinculada. Completá primero el registro con invitación y DNI.")
  if (cuentas.length > 1 && !idUsuario) {
    return { cuentas: cuentas.map(({ idUsuario, inmobiliaria }) => ({ idUsuario, inmobiliaria: inmobiliaria || "Administración general" })) }
  }
  const cuenta = idUsuario ? cuentas.find((item) => item.idUsuario === idUsuario) : cuentas[0]
  if (!cuenta) throw problema("CREDENCIALES_INVALIDAS")
  await db.execute("UPDATE usuarios SET ultimoAcceso = CURRENT_TIMESTAMP WHERE id = ?", [cuenta.idUsuario])
  return sesion(cuenta)
}

async function login(cuerpo = {}) {
  const cuentas = await buscarCuentas(cuerpo.usuario)
  const coinciden = (await Promise.all(cuentas.map(async (cuenta) =>
    cuenta.passwordHash && await bcrypt.compare(cuerpo.password, cuenta.passwordHash) ? cuenta : null
  ))).filter(Boolean)

  if (!coinciden.length) throw problema("CREDENCIALES_INVALIDAS")
  if (coinciden.length > 1 && !cuerpo.idUsuario) {
    return { cuentas: coinciden.map(({ idUsuario, inmobiliaria }) => ({
      idUsuario, inmobiliaria: inmobiliaria || "Administración general",
    })) }
  }
  const cuenta = cuerpo.idUsuario
    ? coinciden.find(({ idUsuario }) => idUsuario === cuerpo.idUsuario)
    : coinciden[0]
  if (!cuenta) throw problema("CREDENCIALES_INVALIDAS")
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

module.exports = { verificarDni, registrar, registrarGoogle, login, loginGoogle, logout }
