const db = require("../../db/conexion")
const { ADMIN, AGENTE } = require("../../config/roles")
const { crearTokenActivacion } = require("../../utils/activacion")

const SELECT_AGENTE = `
  SELECT
    a.id AS id,
    a.id_inmobiliaria AS idInmobiliaria,
    a.id_persona AS idPersona,
    a.id_area AS idArea,
    ar.Nombre AS area,
    a.Activo AS activo,
    u.id AS idUsuario,
    u.Usuario AS usuario,
    u.Estado AS estadoCuenta,
    p.Nombre AS nombre,
    p.Apellido AS apellido,
    p.Correo AS correo,
    p.DNI AS dni,
    p.Teléfono AS telefono,
    p.Dirección AS direccion
  FROM Agentes a
  INNER JOIN Personas p ON p.id = a.id_persona
  INNER JOIN Usuarios u ON u.id_persona = p.id
  LEFT JOIN Areas ar
    ON ar.id = a.id_area AND ar.id_inmobiliaria = a.id_inmobiliaria
`

function condiciones({ idInmobiliaria, busqueda, soloActivos = false }) {
  const filtros = ["u.id_rol = ?"]
  const parametros = [AGENTE]

  if (idInmobiliaria !== null && idInmobiliaria !== undefined) {
    filtros.push("a.id_inmobiliaria = ?")
    parametros.push(idInmobiliaria)
  }

  if (soloActivos) {
    filtros.push("a.Activo = TRUE")
  }

  if (busqueda) {
    filtros.push(`(
      p.Nombre LIKE ? OR
      p.Apellido LIKE ? OR
      p.Correo LIKE ? OR
      p.DNI LIKE ? OR
      u.Usuario LIKE ?
    )`)

    const patron = `%${busqueda}%`
    parametros.push(patron, patron, patron, patron, patron)
  }

  return { filtros, parametros }
}

async function listar({ idInmobiliaria, busqueda, limite, offset }) {
  const filtro = condiciones({ idInmobiliaria, busqueda })
  const [filas] = await db.execute(
    `${SELECT_AGENTE}
     WHERE ${filtro.filtros.join(" AND ")}
     ORDER BY p.Apellido ASC, p.Nombre ASC
     LIMIT ? OFFSET ?`,
    [...filtro.parametros, limite, offset]
  )

  return filas
}

async function contar({ idInmobiliaria, busqueda }) {
  const filtro = condiciones({ idInmobiliaria, busqueda })
  const [filas] = await db.execute(
    `SELECT COUNT(*) AS total
     FROM Agentes a
     INNER JOIN Personas p ON p.id = a.id_persona
     INNER JOIN Usuarios u ON u.id_persona = p.id
     WHERE ${filtro.filtros.join(" AND ")}`,
    filtro.parametros
  )

  return Number(filas[0].total)
}

async function buscarPorId(id, idInmobiliaria) {
  const filtro = condiciones({ idInmobiliaria })
  const [filas] = await db.execute(
    `${SELECT_AGENTE}
     WHERE a.id = ? AND ${filtro.filtros.join(" AND ")}`,
    [id, ...filtro.parametros]
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
        AGENTE,
      ]
    )

    const [agente] = await conexion.execute(
      `INSERT INTO Agentes (id_inmobiliaria, id_persona, id_area)
       VALUES (?, ?, ?)`,
      [datos.idInmobiliaria, persona.insertId, datos.idArea]
    )

    await conexion.execute(
      `INSERT INTO TokensAcceso
        (id_usuario, Token_hash, Proposito, Fecha_expiracion)
       VALUES (?, ?, 'ACTIVACION', ?)`,
      [usuario.insertId, activacion.hash, activacion.fechaExpiracion]
    )

    await conexion.commit()
    return {
      id: agente.insertId,
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

    const filtro = condiciones({ idInmobiliaria })
    const [existentes] = await conexion.execute(
      `SELECT a.id, a.id_persona AS idPersona
       FROM Agentes a
       INNER JOIN Usuarios u ON u.id_persona = a.id_persona
       WHERE a.id = ? AND ${filtro.filtros.join(" AND ")}`,
      [id, ...filtro.parametros]
    )

    if (existentes.length === 0) {
      await conexion.rollback()
      return false
    }

    const agente = existentes[0]
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
        `UPDATE Personas SET ${actualizacionesPersona.join(", ")} WHERE id = ?`,
        [...valoresPersona, agente.idPersona]
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
        `UPDATE Usuarios SET ${actualizacionesUsuario.join(", ")} WHERE id_persona = ?`,
        [...valoresUsuario, agente.idPersona]
      )
    }

    if (Object.prototype.hasOwnProperty.call(datos, "idArea")) {
      await conexion.execute(
        `UPDATE Agentes SET id_area = ? WHERE id = ?`,
        [datos.idArea, id]
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

async function cambiarRol(id, idRol, idInmobiliaria) {
  const conexion = await db.getConnection()

  try {
    const filtros = []
    const parametros = [idRol, id]

    if (idInmobiliaria !== null && idInmobiliaria !== undefined) {
      filtros.push("a.id_inmobiliaria = ?")
      parametros.push(idInmobiliaria)
    }

    filtros.push("u.id_rol IN (?, ?)")
    parametros.push(AGENTE, ADMIN)

    const [resultado] = await conexion.execute(
      `UPDATE Usuarios u
       INNER JOIN Agentes a ON a.id_persona = u.id_persona
       SET u.id_rol = ?
       WHERE a.id = ? AND ${filtros.join(" AND ")}`,
      parametros
    )

    return resultado.affectedRows > 0
  } finally {
    conexion.release()
  }
}

async function eliminar(id, idInmobiliaria) {
  const conexion = await db.getConnection()

  try {
    await conexion.beginTransaction()

    const filtro = condiciones({ idInmobiliaria })
    const [existentes] = await conexion.execute(
      `SELECT a.id, a.id_persona AS idPersona, u.id AS idUsuario
       FROM Agentes a
       INNER JOIN Usuarios u ON u.id_persona = a.id_persona
       WHERE a.id = ? AND ${filtro.filtros.join(" AND ")}`,
      [id, ...filtro.parametros]
    )

    if (existentes.length === 0) {
      await conexion.rollback()
      return false
    }

    const agente = existentes[0]
    await conexion.execute(
      `UPDATE Agentes
       SET Activo = FALSE,
           Fecha_baja = CURRENT_TIMESTAMP,
           Motivo_baja = 'Baja administrativa'
       WHERE id = ?`,
      [id]
    )
    await conexion.execute(
      `UPDATE Usuarios
       SET Estado = 'DESACTIVADO',
           Fecha_baja = CURRENT_TIMESTAMP,
           Motivo_baja = 'Baja administrativa'
       WHERE id = ?`,
      [agente.idUsuario]
    )
    await conexion.execute(
      `UPDATE Personas
       SET Activo = FALSE,
           Fecha_baja = CURRENT_TIMESTAMP,
           Motivo_baja = 'Baja administrativa'
       WHERE id = ?`,
      [agente.idPersona]
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
  cambiarRol,
  eliminar,
}
