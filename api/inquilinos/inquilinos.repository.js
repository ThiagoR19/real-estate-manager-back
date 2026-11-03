const db = require("../../db/conexion")
const { INQUILINO } = require("../../config/roles")
const { crearTokenActivacion } = require("../../utils/activacion")

const SELECT_INQUILINO = `
  SELECT
    p.id AS id,
    p.id_inmobiliaria AS idInmobiliaria,
    p.Nombre AS nombre,
    p.Apellido AS apellido,
    p.Correo AS correo,
    p.DNI AS dni,
    p.Teléfono AS telefono,
    p.Dirección AS direccion,
    u.id AS idUsuario,
    u.Usuario AS usuario,
    u.Estado AS estadoCuenta
  FROM Personas p
  INNER JOIN Usuarios u ON u.id_persona = p.id
`

function condicionInquilino(idInmobiliaria) {
  return {
    sql: "p.id_inmobiliaria = ? AND u.id_rol = ?",
    parametros: [idInmobiliaria, INQUILINO],
  }
}

async function listar({ idInmobiliaria, busqueda, limite, offset }) {
  const condicion = condicionInquilino(idInmobiliaria)
  const condiciones = [condicion.sql]
  const parametros = [...condicion.parametros]

  if (busqueda) {
    condiciones.push(`(
      p.Nombre LIKE ? OR
      p.Apellido LIKE ? OR
      p.Correo LIKE ? OR
      p.DNI LIKE ? OR
      u.Usuario LIKE ?
    )`)

    const patron = `%${busqueda}%`
    parametros.push(patron, patron, patron, patron, patron)
  }

  const [filas] = await db.execute(
    `${SELECT_INQUILINO}
     WHERE ${condiciones.join(" AND ")}
     ORDER BY p.Apellido ASC, p.Nombre ASC
     LIMIT ? OFFSET ?`,
    [...parametros, limite, offset]
  )

  return filas
}

async function contar({ idInmobiliaria, busqueda }) {
  const condicion = condicionInquilino(idInmobiliaria)
  const condiciones = [condicion.sql]
  const parametros = [...condicion.parametros]

  if (busqueda) {
    condiciones.push(`(
      p.Nombre LIKE ? OR
      p.Apellido LIKE ? OR
      p.Correo LIKE ? OR
      p.DNI LIKE ? OR
      u.Usuario LIKE ?
    )`)

    const patron = `%${busqueda}%`
    parametros.push(patron, patron, patron, patron, patron)
  }

  const [filas] = await db.execute(
    `SELECT COUNT(*) AS total
     FROM Personas p
     INNER JOIN Usuarios u ON u.id_persona = p.id
     WHERE ${condiciones.join(" AND ")}`,
    parametros
  )

  return Number(filas[0].total)
}

async function buscarPorId(id, idInmobiliaria) {
  const condicion = condicionInquilino(idInmobiliaria)
  const [filas] = await db.execute(
    `${SELECT_INQUILINO}
     WHERE p.id = ? AND ${condicion.sql}`,
    [id, ...condicion.parametros]
  )

  return filas[0] || null
}

async function crear(datos) {
  const conexion = await db.getConnection()
  const activacion = crearTokenActivacion()

  try {
    await conexion.beginTransaction()

    const [persona] = await conexion.execute(
      `INSERT INTO Personas
        (id_inmobiliaria, Nombre, Apellido, Correo, DNI, Teléfono, Dirección)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        datos.idInmobiliaria,
        datos.nombre,
        datos.apellido,
        datos.correo,
        datos.dni,
        datos.telefono,
        datos.direccion,
      ]
    )

    const [usuario] = await conexion.execute(
      `INSERT INTO Usuarios
        (id_inmobiliaria, id_persona, Usuario, Password_hash, id_rol, Estado)
       VALUES (?, ?, ?, ?, ?, 'PENDIENTE_ACTIVACION')`,
      [
        datos.idInmobiliaria,
        persona.insertId,
        datos.usuario,
        datos.password,
        INQUILINO,
      ]
    )

    await conexion.execute(
      `INSERT INTO TokensAcceso
        (id_usuario, Token_hash, Proposito, Fecha_expiracion)
       VALUES (?, ?, 'ACTIVACION', ?)`,
      [usuario.insertId, activacion.hash, activacion.fechaExpiracion]
    )

    await conexion.commit()
    return {
      idPersona: persona.insertId,
      codigoActivacion: activacion.codigo,
      fechaExpiracion: activacion.fechaExpiracion,
    }
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}

async function actualizar(id, idInmobiliaria, datos) {
  const conexion = await db.getConnection()

  try {
    await conexion.beginTransaction()

    const [existentes] = await conexion.execute(
      `SELECT p.id
       FROM Personas p
       INNER JOIN Usuarios u ON u.id_persona = p.id
       WHERE p.id = ? AND p.id_inmobiliaria = ? AND u.id_rol = ?`,
      [id, idInmobiliaria, INQUILINO]
    )

    if (existentes.length === 0) {
      await conexion.rollback()
      return false
    }

    const camposPersona = {
      nombre: "Nombre",
      apellido: "Apellido",
      correo: "Correo",
      dni: "DNI",
      telefono: "Teléfono",
      direccion: "Dirección",
    }

    const actualizacionesPersona = []
    const valoresPersona = []

    for (const [campo, columna] of Object.entries(camposPersona)) {
      if (!Object.prototype.hasOwnProperty.call(datos, campo)) continue
      actualizacionesPersona.push(`${columna} = ?`)
      valoresPersona.push(datos[campo])
    }

    if (actualizacionesPersona.length > 0) {
      await conexion.execute(
        `UPDATE Personas
         SET ${actualizacionesPersona.join(", ")}
         WHERE id = ? AND id_inmobiliaria = ?`,
        [...valoresPersona, id, idInmobiliaria]
      )
    }

    const actualizacionesUsuario = []
    const valoresUsuario = []

    if (Object.prototype.hasOwnProperty.call(datos, "usuario")) {
      actualizacionesUsuario.push("Usuario = ?")
      valoresUsuario.push(datos.usuario)
    }

    if (Object.prototype.hasOwnProperty.call(datos, "password")) {
      actualizacionesUsuario.push("Password_hash = ?")
      valoresUsuario.push(datos.password)
    }

    if (actualizacionesUsuario.length > 0) {
      await conexion.execute(
        `UPDATE Usuarios u
         INNER JOIN Personas p ON p.id = u.id_persona
         SET ${actualizacionesUsuario.join(", ")}
         WHERE p.id = ? AND p.id_inmobiliaria = ? AND u.id_rol = ?`,
        [...valoresUsuario, id, idInmobiliaria, INQUILINO]
      )
    }

    await conexion.commit()
    return true
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}

async function eliminar(id, idInmobiliaria) {
  const conexion = await db.getConnection()

  try {
    await conexion.beginTransaction()

    const [existentes] = await conexion.execute(
      `SELECT p.id
       FROM Personas p
       INNER JOIN Usuarios u ON u.id_persona = p.id
       WHERE p.id = ? AND p.id_inmobiliaria = ? AND u.id_rol = ?`,
      [id, idInmobiliaria, INQUILINO]
    )

    if (existentes.length === 0) {
      await conexion.rollback()
      return false
    }

    await conexion.execute("DELETE FROM Usuarios WHERE id_persona = ?", [id])
    await conexion.execute(
      "DELETE FROM Personas WHERE id = ? AND id_inmobiliaria = ?",
      [id, idInmobiliaria]
    )

    await conexion.commit()
    return true
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}

module.exports = {
  listar,
  contar,
  buscarPorId,
  crear,
  actualizar,
  eliminar,
}
