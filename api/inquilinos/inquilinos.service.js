const bcrypt = require("bcrypt")
const db = require("../../db/conexion")
const { crearEnlaceActivacion, crearTokenActivacion } = require("../../utils/activacion")
const { INQUILINO } = require("../../config/roles")

const SALT_ROUNDS = Number(process.env.SALT_ROUNDS) || 10

const SELECT_INQUILINO = `
  SELECT
    p.id,
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

function condiciones(inmobiliaria, busqueda) {
  const filtros = ["p.id_inmobiliaria = ?", "u.id_rol = ?"]
  const parametros = [inmobiliaria, INQUILINO]

  if (busqueda) {
    filtros.push(`(
      p.Nombre LIKE ? OR p.Apellido LIKE ? OR p.Correo LIKE ? OR
      p.DNI LIKE ? OR u.Usuario LIKE ?
    )`)
    const texto = `%${busqueda}%`
    parametros.push(texto, texto, texto, texto, texto)
  }

  return { filtros: filtros.join(" AND "), parametros }
}

async function buscarInquilino(id, inmobiliaria, conexion = db) {
  const filtro = condiciones(inmobiliaria)
  const [filas] = await conexion.execute(
    `${SELECT_INQUILINO} WHERE p.id = ? AND ${filtro.filtros}`,
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
       ORDER BY p.Apellido, p.Nombre
       LIMIT ? OFFSET ?`,
      [...filtro.parametros, limite, offset]
    ),
    db.execute(
      `SELECT COUNT(*) AS total
       FROM Personas p
       INNER JOIN Usuarios u ON u.id_persona = p.id
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
  const password = await bcrypt.hash(cuerpo.password, SALT_ROUNDS)
  const activacion = crearTokenActivacion()
  const conexion = await db.getConnection()

  try {
    await conexion.beginTransaction()

    const [persona] = await conexion.execute(
      `INSERT INTO Personas
        (id_inmobiliaria, Nombre, Apellido, Correo, DNI, Teléfono, Dirección)
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
      `INSERT INTO Usuarios
        (id_inmobiliaria, id_persona, Usuario, Password_hash, id_rol, Estado)
       VALUES (?, ?, ?, ?, ?, 'PENDIENTE_ACTIVACION')`,
      [usuario.idInmobi, persona.insertId, cuerpo.usuario, password, INQUILINO]
    )

    await conexion.execute(
      `INSERT INTO TokensAcceso
        (id_usuario, Token_hash, Proposito, Fecha_expiracion)
       VALUES (?, ?, 'ACTIVACION', ?)`,
      [usuarioCreado.insertId, activacion.hash, activacion.fechaExpiracion]
    )

    await conexion.commit()
    return {
      ...(await buscarInquilino(persona.insertId, usuario.idInmobi)),
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
      nombre: "Nombre",
      apellido: "Apellido",
      correo: "Correo",
      dni: "DNI",
      telefono: "Teléfono",
      direccion: "Dirección",
    }
    const cambiosPersona = Object.entries(camposPersona)
      .filter(([campo]) => Object.prototype.hasOwnProperty.call(cuerpo, campo))

    if (cambiosPersona.length) {
      await conexion.execute(
        `UPDATE Personas
         SET ${cambiosPersona.map(([, columna]) => `${columna} = ?`).join(", ")}
         WHERE id = ? AND id_inmobiliaria = ?`,
        [...cambiosPersona.map(([campo]) => cuerpo[campo]), id, usuario.idInmobi]
      )
    }

    const cambiosUsuario = []
    if (Object.prototype.hasOwnProperty.call(cuerpo, "usuario")) {
      cambiosUsuario.push(["Usuario", cuerpo.usuario])
    }
    if (Object.prototype.hasOwnProperty.call(cuerpo, "password")) {
      cambiosUsuario.push(["Password_hash", await bcrypt.hash(cuerpo.password, SALT_ROUNDS)])
    }

    if (cambiosUsuario.length) {
      await conexion.execute(
        `UPDATE Usuarios
         SET ${cambiosUsuario.map(([columna]) => `${columna} = ?`).join(", ")}
         WHERE id = ? AND id_inmobiliaria = ? AND id_rol = ?`,
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

    await conexion.execute("DELETE FROM TokensAcceso WHERE id_usuario = ?", [inquilino.idUsuario])
    await conexion.execute(
      "DELETE FROM Usuarios WHERE id = ? AND id_inmobiliaria = ? AND id_rol = ?",
      [inquilino.idUsuario, usuario.idInmobi, INQUILINO]
    )
    await conexion.execute(
      "DELETE FROM Personas WHERE id = ? AND id_inmobiliaria = ?",
      [id, usuario.idInmobi]
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
