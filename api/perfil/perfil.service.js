const bcrypt = require("bcrypt")
const db = require("../../db/conexion")
const { ADMIN } = require("../../config/roles")
const { saltRounds } = require("../../config/env")

function problema(codigo, mensaje) {
  const error = new Error(mensaje || "")
  error.codigo = codigo
  return error
}

async function buscarPorUsuario(idUsuario) {
  const [filas] = await db.execute(
    `SELECT u.id, u.idInmobiliaria, p.id AS idPersona, p.nombre, p.apellido, p.correo, p.dni, p.telefono, p.direccion, p.fotoPerfil
     FROM usuarios u
     INNER JOIN personas p
       ON p.id = u.idPersona
       AND (p.idInmobiliaria <=> u.idInmobiliaria)
     WHERE u.id = ? AND u.idRol = ?
     LIMIT 1`,
    [idUsuario, ADMIN]
  )
  return filas[0] || null
}

async function obtener(idUsuario) {
  return buscarPorUsuario(idUsuario)
}

async function actualizar(idUsuario, cuerpo = {}) {
  const conexion = await db.getConnection()

  try {
    await conexion.beginTransaction()
    const [filas] = await conexion.execute(
      `SELECT u.id, u.idPersona, u.idInmobiliaria, u.passwordHash
       FROM usuarios u
       WHERE u.id = ? AND u.idRol = ?
       FOR UPDATE`,
      [idUsuario, ADMIN]
    )

    if (!filas.length) {
      await conexion.rollback()
      return null
    }

    const admin = filas[0]
    if (cuerpo.passwordActual) {
      const coincide = admin.passwordHash
        ? await bcrypt.compare(cuerpo.passwordActual, admin.passwordHash)
        : false
      if (!coincide) {
        throw problema("CREDENCIALES_INVALIDAS", "La contraseña actual es incorrecta")
      }
    }

    await conexion.execute(
      `UPDATE personas
       SET nombre = ?, apellido = ?, correo = ?, dni = ?, telefono = ?, direccion = ?
       WHERE id = ? AND (idInmobiliaria <=> ?)`,
      [
        cuerpo.nombre,
        cuerpo.apellido,
        cuerpo.correo,
        cuerpo.dni,
        cuerpo.telefono,
        cuerpo.direccion,
        admin.idPersona,
        admin.idInmobiliaria,
      ]
    )

    if (cuerpo.passwordNueva) {
      const passwordHash = await bcrypt.hash(cuerpo.passwordNueva, saltRounds)
      await conexion.execute(
        "UPDATE usuarios SET passwordHash = ? WHERE id = ? AND idRol = ?",
        [passwordHash, idUsuario, ADMIN]
      )
    }

    await conexion.commit()
    return buscarPorUsuario(idUsuario)
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}

module.exports = { obtener, actualizar }
