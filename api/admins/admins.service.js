const bcrypt = require("bcrypt")
const db = require("../../db/conexion")
const AppError = require("../../utils/app-error")
const { crearEnlaceActivacion, crearTokenActivacion } = require("../../utils/activacion")
const { ADMIN } = require("../../config/roles")
const {
  validarCrearCuenta,
  validarIdRecurso,
  validarListado,
} = require("../../utils/cuenta-validation")

const SALT_ROUNDS = Number(process.env.SALT_ROUNDS) || 10

const SELECT_ADMIN = `
  SELECT
    u.id AS id,
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

function condicionesListado(busqueda) {
  const condiciones = ["u.id_rol = ?"]
  const parametros = [ADMIN]

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

  return { condiciones, parametros }
}

async function listarRegistros({ busqueda, limite, offset }) {
  const filtro = condicionesListado(busqueda)
  const [filas] = await db.execute(
    `${SELECT_ADMIN}
     WHERE ${filtro.condiciones.join(" AND ")}
     ORDER BY p.Apellido ASC, p.Nombre ASC
     LIMIT ? OFFSET ?`,
    [...filtro.parametros, limite, offset]
  )

  return filas
}

async function contarRegistros({ busqueda }) {
  const filtro = condicionesListado(busqueda)
  const [filas] = await db.execute(
    `SELECT COUNT(*) AS total
     FROM Usuarios u
     INNER JOIN Personas p ON p.id = u.id_persona
     WHERE ${filtro.condiciones.join(" AND ")}`,
    filtro.parametros
  )

  return Number(filas[0].total)
}

async function buscarAdminPorId(id) {
  const [filas] = await db.execute(
    `${SELECT_ADMIN}
     WHERE u.id = ? AND u.id_rol = ?`,
    [id, ADMIN]
  )

  return filas[0] || null
}

async function crearRegistro(datos) {
  const conexion = await db.getConnection()
  const activacion = crearTokenActivacion()

  try {
    await conexion.beginTransaction()

    const [persona] = await conexion.execute(`INSERT INTO Personas (id_inmobiliaria, Nombre, Apellido, Correo, DNI, Teléfono, Dirección) VALUES (?, ?, ?, ?, ?, ?, ?)`, [datos.idInmobiliaria, datos.nombre, datos.apellido, datos.correo, datos.dni, datos.telefono, datos.direccion,])

    const [usuario] = await conexion.execute(`INSERT INTO Usuarios (id_inmobiliaria, id_persona, Usuario, Password_hash, id_rol, Estado) VALUES (?, ?, ?, ?, 'PENDIENTE_ACTIVACION')`, [datos.idInmobiliaria, persona.insertId, datos.usuario, datos.password, ADMIN,])

    await conexion.execute(`INSERT INTO TokensAcceso (id_usuario, Token_hash, Proposito, Fecha_expiracion) VALUES (?, ?, 'ACTIVACION', ?)`, [usuario.insertId, activacionhash, activacion.fechaExpiracion])

    await conexion.commit()
    return {
      id: usuario.insertId,
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

async function eliminarRegistro(id) {
  const conexion = await db.getConnection()

  try {
    await conexion.beginTransaction()

    const [existentes] = await conexion.execute(
      `SELECT u.id, u.id_persona AS idPersona
       FROM Usuarios u
       WHERE u.id = ? AND u.id_rol = ?`,
      [id, ADMIN]
    )

    if (existentes.length === 0) {
      await conexion.rollback()
      return false
    }

    const admin = existentes[0]
    await conexion.execute(
      `UPDATE Usuarios
       SET Estado = 'DESACTIVADO',
           Fecha_baja = CURRENT_TIMESTAMP,
           Motivo_baja = 'Baja administrativa'
       WHERE id = ?`,
      [id]
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

function traducirError(error) {
  if (error instanceof AppError) return error

  if (error.code === "ER_DUP_ENTRY") {
    const mensaje = String(error.sqlMessage || error.message || "")

    if (mensaje.includes("Usuario")) {
      return new AppError("CONFLICTO", "El nombre de usuario ya está en uso")
    }

    return new AppError("CONFLICTO", "Ya existe un registro con alguno de los datos enviados")
  }

  if (error.code === "ER_NO_REFERENCED_ROW_2" || error.code === "ER_NO_REFERENCED_ROW") {
    return new AppError("DATOS_INVALIDOS", "La inmobiliaria indicada no existe")
  }

  return error
}

async function listar(query) {
  const filtros = validarListado(query)

  try {
    const [items, total] = await Promise.all([
      listarRegistros(filtros),
      contarRegistros(filtros),
    ])

    return {
      items,
      paginacion: {
        pagina: filtros.pagina,
        limite: filtros.limite,
        total,
        paginas: Math.ceil(total / filtros.limite),
      },
    }
  } catch (error) {
    throw traducirError(error)
  }
}

async function crear(cuerpo) {
  const datos = validarCrearCuenta(cuerpo, { inmobiliariaObligatoria: true })
  datos.password = await bcrypt.hash(datos.password, SALT_ROUNDS)

  try {
    const cuenta = await crearRegistro(datos)
    const admin = await buscarAdminPorId(cuenta.id)

    return {
      ...admin,
      activacion: {
        codigo: cuenta.codigoActivacion,
        enlace: crearEnlaceActivacion(cuenta.codigoActivacion),
        expiraEn: cuenta.fechaExpiracion.toISOString(),
      },
    }
  } catch (error) {
    throw traducirError(error)
  }
}

async function eliminar(valorId) {
  const id = validarIdRecurso(valorId, "id")

  try {
    const eliminado = await eliminarRegistro(id)

    if (!eliminado) {
      throw new AppError("NO_ENCONTRADO", "El administrador no existe")
    }
  } catch (error) {
    throw traducirError(error)
  }
}

module.exports = { listar, crear, eliminar }
