const bcrypt = require("bcrypt")
const db = require("../../db/conexion")
const { crearEnlaceActivacion, crearTokenActivacion } = require("../../utils/activacion")
const { ADMIN } = require("../../config/roles")

const SALT_ROUNDS = Number(process.env.SALT_ROUNDS) || 10

const SELECT_ADMIN = `
  SELECT
    u.id,
    u.id_inmobiliaria AS idInmobiliaria,
    p.id AS idPersona,
    p.Nombre AS nombre,
    p.Apellido AS apellido,
    p.Correo AS correo,
    p.DNI AS dni,
    p.Teléfono AS telefono,
    p.Dirección AS direccion,
    u.Usuario AS usuario,
    u.Estado AS estadoCuenta
  FROM Usuarios u
  INNER JOIN Personas p ON p.id = u.id_persona
`

function condiciones(busqueda) {
  const filtros = ["u.id_rol = ?"]
  const parametros = [ADMIN]

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

async function buscarAdmin(id) {
  const [filas] = await db.execute(
    `${SELECT_ADMIN} WHERE u.id = ? AND u.id_rol = ?`,
    [id, ADMIN]
  )
  return filas[0] || null
}

async function listar(query = {}) {
  const filtro = condiciones(query.q)
  const pagina = Number(query.page || 1)
  const limite = Number(query.limit || 20)
  const offset = (pagina - 1) * limite

  const [filas, conteo] = await Promise.all([
    db.execute(
      `${SELECT_ADMIN}
       WHERE ${filtro.filtros}
       ORDER BY p.Apellido, p.Nombre
       LIMIT ? OFFSET ?`,
      [...filtro.parametros, limite, offset]
    ),
    db.execute(
      `SELECT COUNT(*) AS total
       FROM Usuarios u
       INNER JOIN Personas p ON p.id = u.id_persona
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

async function crear(cuerpo = {}) {
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
        cuerpo.idInmobiliaria,
        cuerpo.nombre,
        cuerpo.apellido,
        cuerpo.correo,
        cuerpo.dni,
        cuerpo.telefono,
        cuerpo.direccion,
      ]
    )

    const [usuario] = await conexion.execute(
      `INSERT INTO Usuarios
        (id_inmobiliaria, id_persona, Usuario, Password_hash, id_rol, Estado)
       VALUES (?, ?, ?, ?, ?, 'PENDIENTE_ACTIVACION')`,
      [cuerpo.idInmobiliaria, persona.insertId, cuerpo.usuario, password, ADMIN]
    )

    await conexion.execute(
      `INSERT INTO TokensAcceso
        (id_usuario, Token_hash, Proposito, Fecha_expiracion)
       VALUES (?, ?, 'ACTIVACION', ?)`,
      [usuario.insertId, activacion.hash, activacion.fechaExpiracion]
    )

    await conexion.commit()
    return {
      ...(await buscarAdmin(usuario.insertId)),
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

async function eliminar(id) {
  const conexion = await db.getConnection()

  try {
    await conexion.beginTransaction()

    const [filas] = await conexion.execute(
      `SELECT u.id, u.id_persona AS idPersona
       FROM Usuarios u
       WHERE u.id = ? AND u.id_rol = ?`,
      [id, ADMIN]
    )

    if (!filas.length) {
      await conexion.rollback()
      return false
    }

    const admin = filas[0]
    await conexion.execute(
      `UPDATE Usuarios
       SET Estado = 'DESACTIVADO',
           Fecha_baja = CURRENT_TIMESTAMP,
           Motivo_baja = 'Baja administrativa'
       WHERE id = ?`,
      [admin.id]
    )
    await conexion.execute(
      `UPDATE Personas
       SET Activo = FALSE,
           Fecha_baja = CURRENT_TIMESTAMP,
           Motivo_baja = 'Baja administrativa'
       WHERE id = ?`,
      [admin.idPersona]
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

module.exports = { listar, crear, eliminar }
