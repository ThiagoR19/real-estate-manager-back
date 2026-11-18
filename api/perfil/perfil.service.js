require("dotenv/config")

const bcrypt = require("bcrypt")
const db = require("../../db/conexion")
const { SUPERADMIN, ADMIN, AGENTE, PROPIETARIO, INQUILINO } = require("../../config/roles")

const saltRounds = Number(process.env.SALT_ROUNDS) || 10

const CAMPOS_PERSONALES = ["nombre", "apellido", "telefono", "correo", "direccion"]

const CAMPOS_POR_ROL = {
  [SUPERADMIN]: CAMPOS_PERSONALES,
  [ADMIN]: CAMPOS_PERSONALES,
  [AGENTE]: CAMPOS_PERSONALES,
  [PROPIETARIO]: CAMPOS_PERSONALES,
  [INQUILINO]: CAMPOS_PERSONALES,
}

const CAMPO_POR_INDICE = {
  uq_Personas_1: "dni",
  uq_Personas_2: "correo",
}

const SELECT_PERFIL = `
  SELECT
    u.id,
    u.usuario,
    (u.passwordHash IS NOT NULL) AS tieneContrasena,
    (u.googleSub IS NOT NULL) AS googleVinculado,
    u.idRol,
    r.nombre AS rol,
    u.idInmobiliaria,
    i.nombre AS inmobiliaria,
    p.id AS idPersona,
    p.nombre,
    p.apellido,
    p.telefono,
    p.correo,
    p.direccion,
    p.dni,
    p.fotoPerfil,
    u.fechaActivacion,
    u.ultimoAcceso
  FROM usuarios u
  INNER JOIN personas p
    ON p.id = u.idPersona
    AND (p.idInmobiliaria <=> u.idInmobiliaria)
  INNER JOIN roles r
    ON r.id = u.idRol
  LEFT JOIN inmobiliaria i
    ON i.id = u.idInmobiliaria
  WHERE u.id = ?
`

const CARPETA_FOTOS = "perfiles"

const camposEditables = (idRol) => CAMPOS_POR_ROL[idRol] || []

async function obtener(idUsuario) {
  const [filas] = await db.execute(SELECT_PERFIL, [idUsuario])
  if (!filas.length) {
    return null
  }
  const perfil = filas[0]
  return {
    ...perfil,
    urlFotoPerfil: perfil.fotoPerfil ? `/uploads/${CARPETA_FOTOS}/${perfil.fotoPerfil}` : null,
    camposEditables: camposEditables(perfil.idRol),
  }
}

async function reemplazarFoto(idUsuario, nombre) {
  const conexion = await db.getConnection()
  try {
    await conexion.beginTransaction()
    const [filas] = await conexion.execute(
      `SELECT p.id, p.fotoPerfil
       FROM usuarios u
       INNER JOIN personas p
         ON p.id = u.idPersona
         AND (p.idInmobiliaria <=> u.idInmobiliaria)
       WHERE u.id = ?
       FOR UPDATE`,
      [idUsuario]
    )
    if (!filas.length) {
      await conexion.rollback()
      return null
    }

    await conexion.execute(`UPDATE personas SET fotoPerfil = ? WHERE id = ?`, [nombre, filas[0].id])
    await conexion.commit()
    return { anterior: filas[0].fotoPerfil, perfil: await obtener(idUsuario) }
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}

async function actualizar(idUsuario, cambios) {
  const perfil = await obtener(idUsuario)
  if (!perfil) {
    return { error: "NO_ENCONTRADO", mensaje: "El usuario no existe" }
  }

  const permitidos = perfil.camposEditables
  const prohibidos = Object.keys(cambios).filter((campo) => !permitidos.includes(campo))
  if (prohibidos.length) {
    return {
      error: "SIN_PERMISO",
      mensaje: "Su rol no puede modificar algunos de estos datos",
      detalles: prohibidos.map((campo) => ({ campo, problema: "Su rol no puede modificar este dato" })),
    }
  }

  const campos = CAMPOS_PERSONALES.filter((campo) => campo in cambios)
  try {
    await db.execute(
      `UPDATE personas SET ${campos.map((campo) => `${campo} = ?`).join(", ")} WHERE id = ?`,
      [...campos.map((campo) => cambios[campo]), perfil.idPersona]
    )
  } catch (error) {
    if (error.code !== "ER_DUP_ENTRY") {
      throw error
    }
    const indice = Object.keys(CAMPO_POR_INDICE).find((nombre) => error.message.includes(nombre))
    const campo = CAMPO_POR_INDICE[indice]
    return {
      error: "CONFLICTO",
      mensaje: campo ? `Ese ${campo === "dni" ? "DNI" : "correo"} ya está registrado` : undefined,
      detalles: campo ? [{ campo, problema: "Ya está registrado" }] : undefined,
    }
  }

  return { perfil: await obtener(idUsuario) }
}

async function cambiarContrasena(idUsuario, { actual, nueva }) {
  const [filas] = await db.execute(`SELECT u.passwordHash, u.googleSub FROM usuarios u WHERE u.id = ?`, [idUsuario])
  if (!filas.length) {
    return { error: "NO_ENCONTRADO", mensaje: "El usuario no existe" }
  }

  if (!filas[0].passwordHash) {
    if (!filas[0].googleSub || actual) {
      return { error: "DATOS_INVALIDOS", mensaje: "No se puede crear una contraseña para esta cuenta" }
    }
  } else if (!actual || !await bcrypt.compare(actual, filas[0].passwordHash)) {
    return {
      error: "DATOS_INVALIDOS",
      mensaje: "La contraseña actual no es correcta",
      detalles: [{ campo: "actual", problema: "La contraseña actual no es correcta" }],
    }
  }

  const passwordHash = await bcrypt.hash(nueva, saltRounds)
  const [resultado] = await db.execute(`UPDATE usuarios SET passwordHash = ? WHERE id = ? AND passwordHash <=> ?`,
    [passwordHash, idUsuario, filas[0].passwordHash])
  if (!resultado.affectedRows) return { error: "CONFLICTO", mensaje: "La contraseña cambió. Volvé a cargar el perfil." }
  return {}
}

module.exports = { obtener, actualizar, cambiarContrasena, reemplazarFoto, CARPETA_FOTOS }
