const bcrypt = require("bcrypt")
const db = require("../../db/conexion")
const { crearEnlaceActivacion, crearTokenActivacion } = require("../../utils/activacion")
const { SUPERADMIN, ADMIN, AGENTE } = require("../../config/roles")

const SALT_ROUNDS = Number(process.env.SALT_ROUNDS) || 10

const SELECT_AGENTE = `
  SELECT
    a.id,
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
  LEFT JOIN Areas ar ON ar.id = a.id_area
    AND ar.id_inmobiliaria = a.id_inmobiliaria
`

function inmobiliaria(usuario, valor) {
  return usuario.rol === SUPERADMIN ? valor || null : usuario.idInmobi
}

function filtro(usuario, valor, busqueda) {
  const idInmobiliaria = inmobiliaria(usuario, valor)
  const condiciones = ["u.id_rol = ?"]
  const parametros = [AGENTE]

  if (idInmobiliaria !== null) {
    condiciones.push("a.id_inmobiliaria = ?")
    parametros.push(idInmobiliaria)
  }

  if (busqueda) {
    condiciones.push(`(
      p.Nombre LIKE ? OR p.Apellido LIKE ? OR p.Correo LIKE ? OR
      p.DNI LIKE ? OR u.Usuario LIKE ?
    )`)
    const texto = `%${busqueda}%`
    parametros.push(texto, texto, texto, texto, texto)
  }

  return { idInmobiliaria, sql: condiciones.join(" AND "), parametros }
}

async function buscarPorId(usuario, id) {
  const condiciones = filtro(usuario)
  const [filas] = await db.execute(
    `${SELECT_AGENTE} WHERE a.id = ? AND ${condiciones.sql}`,
    [id, ...condiciones.parametros]
  )
  return filas[0] || null
}

async function listar(usuario, query = {}) {
  const condiciones = filtro(usuario, query.idInmobiliaria, query.q)
  const pagina = Number(query.page || 1)
  const limite = Number(query.limit || 20)
  const offset = (pagina - 1) * limite

  const [filas, conteo] = await Promise.all([
    db.execute(
      `${SELECT_AGENTE}
       WHERE ${condiciones.sql}
       ORDER BY p.Apellido, p.Nombre
       LIMIT ? OFFSET ?`,
      [...condiciones.parametros, limite, offset]
    ),
    db.execute(
      `SELECT COUNT(*) AS total
       FROM Agentes a
       INNER JOIN Personas p ON p.id = a.id_persona
       INNER JOIN Usuarios u ON u.id_persona = p.id
       WHERE ${condiciones.sql}`,
      condiciones.parametros
    ),
  ])

  const total = Number(conteo[0][0].total)
  return {
    items: filas[0],
    paginacion: { pagina, limite, total, paginas: Math.ceil(total / limite) },
  }
}

async function crear(usuario, cuerpo = {}) {
  const idInmobiliaria = inmobiliaria(usuario, cuerpo.idInmobiliaria)
  const password = await bcrypt.hash(cuerpo.password, SALT_ROUNDS)
  const activacion = crearTokenActivacion()
  const conexion = await db.getConnection()

  try {
    await conexion.beginTransaction()

    const [persona] = await conexion.execute(
      `INSERT INTO Personas
        (id_inmobiliaria, Nombre, Apellido, Correo, DNI, Teléfono, Dirección)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [idInmobiliaria, cuerpo.nombre, cuerpo.apellido, cuerpo.correo, cuerpo.dni, cuerpo.telefono, cuerpo.direccion]
    )

    const [usuarioCreado] = await conexion.execute(
      `INSERT INTO Usuarios
        (id_inmobiliaria, id_persona, Usuario, Password_hash, id_rol, Estado)
       VALUES (?, ?, ?, ?, ?, 'PENDIENTE_ACTIVACION')`,
      [idInmobiliaria, persona.insertId, cuerpo.usuario, password, AGENTE]
    )

    const [agente] = await conexion.execute(
      `INSERT INTO Agentes (id_inmobiliaria, id_persona, id_area)
       VALUES (?, ?, ?)`,
      [idInmobiliaria, persona.insertId, cuerpo.idArea]
    )

    await conexion.execute(
      `INSERT INTO TokensAcceso
        (id_usuario, Token_hash, Proposito, Fecha_expiracion)
       VALUES (?, ?, 'ACTIVACION', ?)`,
      [usuarioCreado.insertId, activacion.hash, activacion.fechaExpiracion]
    )

    await conexion.commit()
    return {
      ...(await buscarPorId({ rol: SUPERADMIN }, agente.insertId)),
      activacion: {
        codigo: activacion.codigo,
        enlace: crearEnlaceActivacion(activacion.codigo),
        expiraEn: activacion.fechaExpiracion.toISOString(),
      },
    }
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}

async function actualizar(usuario, id, cuerpo = {}) {
  const condiciones = filtro(usuario)
  const conexion = await db.getConnection()

  try {
    await conexion.beginTransaction()
    const [filas] = await conexion.execute(
      `SELECT a.id, a.id_inmobiliaria AS idInmobiliaria, a.id_persona AS idPersona, u.id AS idUsuario
       FROM Agentes a
       INNER JOIN Usuarios u ON u.id_persona = a.id_persona
       WHERE a.id = ? AND ${condiciones.sql}`,
      [id, ...condiciones.parametros]
    )

    if (!filas.length) {
      await conexion.rollback()
      return null
    }

    const agente = filas[0]
    const persona = {
      nombre: "Nombre",
      apellido: "Apellido",
      correo: "Correo",
      dni: "DNI",
      telefono: "Teléfono",
      direccion: "Dirección",
    }
    const cambiosPersona = Object.entries(persona)
      .filter(([campo]) => Object.hasOwn(cuerpo, campo))

    if (cambiosPersona.length) {
      await conexion.execute(
        `UPDATE Personas
         SET ${cambiosPersona.map(([, columna]) => `\`${columna}\` = ?`).join(", ")}
         WHERE id = ? AND id_inmobiliaria = ?`,
        [...cambiosPersona.map(([campo]) => cuerpo[campo]), agente.idPersona, agente.idInmobiliaria]
      )
    }

    const cambiosUsuario = []
    if (Object.hasOwn(cuerpo, "usuario")) cambiosUsuario.push(["Usuario", cuerpo.usuario])
    if (Object.hasOwn(cuerpo, "password")) {
      cambiosUsuario.push(["Password_hash", await bcrypt.hash(cuerpo.password, SALT_ROUNDS)])
    }

    if (cambiosUsuario.length) {
      await conexion.execute(
        `UPDATE Usuarios
         SET ${cambiosUsuario.map(([columna]) => `\`${columna}\` = ?`).join(", ")}
         WHERE id = ? AND id_inmobiliaria = ?`,
        [...cambiosUsuario.map(([, valor]) => valor), agente.idUsuario, agente.idInmobiliaria]
      )
    }

    if (Object.hasOwn(cuerpo, "idArea")) {
      await conexion.execute(
        `UPDATE Agentes SET id_area = ? WHERE id = ? AND id_inmobiliaria = ?`,
        [cuerpo.idArea, id, agente.idInmobiliaria]
      )
    }

    await conexion.commit()
    return buscarPorId(usuario, id)
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}

async function cambiarRol(usuario, id, rol) {
  const idInmobiliaria = inmobiliaria(usuario)
  const condiciones = ["u.id_rol IN (?, ?)"]
  const parametros = [AGENTE, ADMIN]
  const nuevoRol = { ADMIN, AGENTE }[String(rol).toUpperCase()] || rol

  if (idInmobiliaria !== null) {
    condiciones.push("a.id_inmobiliaria = ?")
    parametros.push(idInmobiliaria)
  }

  const [resultado] = await db.execute(
    `UPDATE Usuarios u
     INNER JOIN Agentes a ON a.id_persona = u.id_persona
     SET u.id_rol = ?
     WHERE a.id = ? AND ${condiciones.join(" AND ")}`,
    [nuevoRol, id, ...parametros]
  )
  return { id, rol: nuevoRol, afectados: resultado.affectedRows }
}

async function eliminar(usuario, id) {
  const condiciones = filtro(usuario)
  const conexion = await db.getConnection()

  try {
    await conexion.beginTransaction()
    const [filas] = await conexion.execute(
      `SELECT a.id_persona AS idPersona, u.id AS idUsuario, a.id_inmobiliaria AS idInmobiliaria
       FROM Agentes a
       INNER JOIN Usuarios u ON u.id_persona = a.id_persona
       WHERE a.id = ? AND ${condiciones.sql}`,
      [id, ...condiciones.parametros]
    )

    if (!filas.length) {
      await conexion.rollback()
      return false
    }

    const agente = filas[0]
    await conexion.execute("DELETE FROM TokensAcceso WHERE id_usuario = ?", [agente.idUsuario])
    await conexion.execute("DELETE FROM Agentes WHERE id = ? AND id_inmobiliaria = ?", [id, agente.idInmobiliaria])
    await conexion.execute("DELETE FROM Usuarios WHERE id = ? AND id_inmobiliaria = ?", [agente.idUsuario, agente.idInmobiliaria])
    await conexion.execute("DELETE FROM Personas WHERE id = ? AND id_inmobiliaria = ?", [agente.idPersona, agente.idInmobiliaria])
    await conexion.commit()
    return true
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}

module.exports = { listar, buscarPorId, crear, actualizar, cambiarRol, eliminar }
