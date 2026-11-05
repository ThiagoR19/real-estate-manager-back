const bcrypt = require("bcrypt")
const db = require("../../db/conexion")
const { crearEnlaceActivacion, crearTokenActivacion } = require("../../utils/activacion")
const { INQUILINO } = require("../../config/roles")
const { saltRounds } = require("../../config/env")

const SELECT_INQUILINO = `
  SELECT
    i.id,
    i.idInmobiliaria,
    i.idPersona,
    i.activo,
    p.nombre,
    p.apellido,
    p.correo,
    p.dni,
    p.telefono,
    p.direccion,
    u.id AS idUsuario,
    u.usuario,
    CASE
      WHEN u.fechaActivacion IS NULL THEN 'PENDIENTE_ACTIVACION'
      ELSE 'ACTIVO'
    END AS estadoCuenta
  FROM inquilinos i
  INNER JOIN personas p
    ON p.id = i.idPersona
    AND p.idInmobiliaria = i.idInmobiliaria
  INNER JOIN usuarios u
    ON u.idPersona = p.id
    AND u.idInmobiliaria = i.idInmobiliaria
`

function condiciones(inmobiliaria, busqueda) {
  const filtros = ["i.idInmobiliaria = ?", "u.idRol = ?"]
  const parametros = [inmobiliaria, INQUILINO]

  if (busqueda) {
    filtros.push(`(
      p.nombre LIKE ? OR p.apellido LIKE ? OR p.correo LIKE ? OR
      p.dni LIKE ? OR u.usuario LIKE ?
    )`)
    const texto = `%${busqueda}%`
    parametros.push(texto, texto, texto, texto, texto)
  }

  return { filtros: filtros.join(" AND "), parametros }
}

async function buscarInquilino(id, inmobiliaria, conexion = db) {
  const filtro = condiciones(inmobiliaria)
  const [filas] = await conexion.execute(
    `${SELECT_INQUILINO} WHERE i.id = ? AND ${filtro.filtros}`,
    [id, ...filtro.parametros]
  )
  return filas[0] || null
}

async function listar(usuario, query = {}) {
  const filtro = condiciones(usuario.idInmobi, query.q)
  const pagina = Number(query.page || 1)
  const limite = Number(query.limit || 20)
  const offset = (pagina - 1) * limite

  const [filas, conteo] = await Promise.all([
    db.execute(
      `${SELECT_INQUILINO}
       WHERE ${filtro.filtros}
       ORDER BY p.apellido, p.nombre
       LIMIT ? OFFSET ?`,
      [...filtro.parametros, limite, offset]
    ),
    db.execute(
      `SELECT COUNT(*) AS total
       FROM inquilinos i
       INNER JOIN personas p
         ON p.id = i.idPersona
         AND p.idInmobiliaria = i.idInmobiliaria
       INNER JOIN usuarios u
         ON u.idPersona = p.id
         AND u.idInmobiliaria = i.idInmobiliaria
       WHERE ${filtro.filtros}`,
      filtro.parametros
    ),
  ])

  const total = Number(conteo[0][0].total)
  return {
    items: filas[0],
    paginacion: {
      pagina,
      limite,
      total,
      paginas: Math.ceil(total / limite),
    },
  }
}

async function buscarPorId(usuario, id) {
  return buscarInquilino(id, usuario.idInmobi)
}

async function crear(usuario, cuerpo = {}) {
  const password = await bcrypt.hash(cuerpo.password, saltRounds)
  const activacion = crearTokenActivacion()
  const conexion = await db.getConnection()

  try {
    await conexion.beginTransaction()

    const [persona] = await conexion.execute(
      `INSERT INTO personas
        (idInmobiliaria, nombre, apellido, correo, dni, telefono, direccion)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        usuario.idInmobi,
        cuerpo.nombre,
        cuerpo.apellido,
        cuerpo.correo,
        cuerpo.dni,
        cuerpo.telefono,
        cuerpo.direccion,
      ]
    )

    const [usuarioCreado] = await conexion.execute(
      `INSERT INTO usuarios
        (idInmobiliaria, idPersona, usuario, passwordHash, idRol)
       VALUES (?, ?, ?, ?, ?)`,
      [usuario.idInmobi, persona.insertId, cuerpo.usuario, password, INQUILINO]
    )

    await conexion.execute(
      `INSERT INTO tokensAcceso
        (idUsuario, tokenHash, proposito, fechaExpiracion)
       VALUES (?, ?, 'ACTIVACION', ?)`,
      [usuarioCreado.insertId, activacion.hash, activacion.fechaExpiracion]
    )

    const [inquilino] = await conexion.execute(
      `INSERT INTO inquilinos (idInmobiliaria, idPersona)
       VALUES (?, ?)`,
      [usuario.idInmobi, persona.insertId]
    )

    await conexion.commit()
    return {
      ...(await buscarInquilino(inquilino.insertId, usuario.idInmobi)),
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
  const conexion = await db.getConnection()

  try {
    await conexion.beginTransaction()
    const inquilino = await buscarInquilino(id, usuario.idInmobi, conexion)

    if (!inquilino) {
      await conexion.rollback()
      return null
    }

    const camposPersona = {
      nombre: "nombre",
      apellido: "apellido",
      correo: "correo",
      dni: "dni",
      telefono: "telefono",
      direccion: "direccion",
    }
    const cambiosPersona = Object.entries(camposPersona)
      .filter(([campo]) => Object.prototype.hasOwnProperty.call(cuerpo, campo))

    if (cambiosPersona.length) {
      await conexion.execute(
        `UPDATE personas
         SET ${cambiosPersona.map(([, columna]) => `${columna} = ?`).join(", ")}
         WHERE id = ? AND idInmobiliaria = ?`,
        [...cambiosPersona.map(([campo]) => cuerpo[campo]), inquilino.idPersona, usuario.idInmobi]
      )
    }

    const cambiosUsuario = []
    if (Object.prototype.hasOwnProperty.call(cuerpo, "usuario")) {
      cambiosUsuario.push(["usuario", cuerpo.usuario])
    }
    if (Object.prototype.hasOwnProperty.call(cuerpo, "password")) {
      cambiosUsuario.push(["passwordHash", await bcrypt.hash(cuerpo.password, saltRounds)])
    }

    if (cambiosUsuario.length) {
      await conexion.execute(
        `UPDATE usuarios
         SET ${cambiosUsuario.map(([columna]) => `${columna} = ?`).join(", ")}
         WHERE id = ? AND idInmobiliaria = ? AND idRol = ?`,
        [...cambiosUsuario.map(([, valor]) => valor), inquilino.idUsuario, usuario.idInmobi, INQUILINO]
      )
    }

    await conexion.commit()
    return buscarInquilino(id, usuario.idInmobi)
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}

async function eliminar(usuario, id) {
  const conexion = await db.getConnection()

  try {
    await conexion.beginTransaction()
    const inquilino = await buscarInquilino(id, usuario.idInmobi, conexion)

    if (!inquilino) {
      await conexion.rollback()
      return false
    }

    await conexion.execute("DELETE FROM tokensAcceso WHERE idUsuario = ?", [inquilino.idUsuario])
    await conexion.execute(
      "DELETE FROM inquilinos WHERE id = ? AND idInmobiliaria = ?",
      [id, usuario.idInmobi]
    )
    await conexion.execute(
      "DELETE FROM usuarios WHERE id = ? AND idInmobiliaria = ? AND idRol = ?",
      [inquilino.idUsuario, usuario.idInmobi, INQUILINO]
    )
    await conexion.execute(
      "DELETE FROM personas WHERE id = ? AND idInmobiliaria = ?",
      [inquilino.idPersona, usuario.idInmobi]
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

module.exports = { listar, buscarPorId, crear, actualizar, eliminar }
