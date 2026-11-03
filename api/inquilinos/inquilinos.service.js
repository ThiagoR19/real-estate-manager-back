const bcrypt = require("bcrypt")
const db = require("../../db/conexion")
const AppError = require("../../utils/app-error")
const { crearEnlaceActivacion, crearTokenActivacion } = require("../../utils/activacion")
const {
  validarCrear,
  validarActualizar,
  validarId,
  validarListado,
} = require("./inquilinos.validation")

const SALT_ROUNDS = Number(process.env.SALT_ROUNDS) || 10

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

function construirCondicionesInquilino({ idInmobiliaria, busqueda }) {
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

  return { condiciones, parametros }
}

async function listarInquilinos({ idInmobiliaria, busqueda, limite, offset }) {
  const filtro = construirCondicionesInquilino({ idInmobiliaria, busqueda })
  const [filas] = await db.execute(
    `${SELECT_INQUILINO}
     WHERE ${filtro.condiciones.join(" AND ")}
     ORDER BY p.Apellido ASC, p.Nombre ASC
     LIMIT ? OFFSET ?`,
    [...filtro.parametros, limite, offset]
  )

  return filas
}

async function contarInquilinos({ idInmobiliaria, busqueda }) {
  const filtro = construirCondicionesInquilino({ idInmobiliaria, busqueda })
  const [filas] = await db.execute(
    `SELECT COUNT(*) AS total
     FROM Personas p
     INNER JOIN Usuarios u ON u.id_persona = p.id
     WHERE ${filtro.condiciones.join(" AND ")}`,
    filtro.parametros
  )

  return Number(filas[0].total)
}

async function buscarInquilinoPorId(id, idInmobiliaria) {
  const condicion = condicionInquilino(idInmobiliaria)
  const [filas] = await db.execute(
    `${SELECT_INQUILINO}
     WHERE p.id = ? AND ${condicion.sql}`,
    [id, ...condicion.parametros]
  )

  return filas[0] || null
}

async function crearInquilino(datos) {
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

async function actualizarInquilino(id, idInmobiliaria, datos) {
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

async function eliminarInquilino(id, idInmobiliaria) {
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

function obtenerIdInmobiliaria(usuario) {
  const idInmobiliaria = Number(usuario && usuario.idInmobi)

  if (!Number.isInteger(idInmobiliaria) || idInmobiliaria <= 0) {
    throw new AppError(
      "DATOS_INVALIDOS",
      "La sesión no tiene una inmobiliaria válida asociada"
    )
  }

  return idInmobiliaria
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

  if (error.code === "ER_ROW_IS_REFERENCED_2" || error.code === "ER_ROW_IS_REFERENCED") {
    return new AppError(
      "CONFLICTO",
      "No se puede eliminar el inquilino porque tiene información relacionada"
    )
  }

  if (error.code === "ER_NO_REFERENCED_ROW_2" || error.code === "ER_NO_REFERENCED_ROW") {
    return new AppError("DATOS_INVALIDOS", "La inmobiliaria indicada no existe")
  }

  return error
}

async function listar(usuario, query) {
  const idInmobiliaria = obtenerIdInmobiliaria(usuario)
  const filtros = validarListado(query)

  try {
    const [items, total] = await Promise.all([
      listarInquilinos({ idInmobiliaria, ...filtros }),
      contarInquilinos({ idInmobiliaria, ...filtros }),
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

async function buscarPorId(usuario, valorId) {
  const idInmobiliaria = obtenerIdInmobiliaria(usuario)
  const id = validarId(valorId)

  try {
    const inquilino = await buscarInquilinoPorId(id, idInmobiliaria)

    if (!inquilino) {
      throw new AppError("NO_ENCONTRADO", "El inquilino no existe")
    }

    return inquilino
  } catch (error) {
    throw traducirError(error)
  }
}

async function crear(usuario, cuerpo) {
  const idInmobiliaria = obtenerIdInmobiliaria(usuario)
  const datos = validarCrear(cuerpo)
  datos.idInmobiliaria = idInmobiliaria
  datos.password = await bcrypt.hash(datos.password, SALT_ROUNDS)

  try {
    const cuenta = await crearInquilino(datos)
    const inquilino = await buscarInquilinoPorId(cuenta.idPersona, idInmobiliaria)

    return {
      ...inquilino,
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

async function actualizar(usuario, valorId, cuerpo) {
  const idInmobiliaria = obtenerIdInmobiliaria(usuario)
  const id = validarId(valorId)
  const datos = validarActualizar(cuerpo)

  if (datos.password !== undefined) {
    datos.password = await bcrypt.hash(datos.password, SALT_ROUNDS)
  }

  try {
    const actualizado = await actualizarInquilino(id, idInmobiliaria, datos)

    if (!actualizado) {
      throw new AppError("NO_ENCONTRADO", "El inquilino no existe")
    }

    return buscarInquilinoPorId(id, idInmobiliaria)
  } catch (error) {
    throw traducirError(error)
  }
}

async function eliminar(usuario, valorId) {
  const idInmobiliaria = obtenerIdInmobiliaria(usuario)
  const id = validarId(valorId)

  try {
    const eliminado = await eliminarInquilino(id, idInmobiliaria)

    if (!eliminado) {
      throw new AppError("NO_ENCONTRADO", "El inquilino no existe")
    }
  } catch (error) {
    throw traducirError(error)
  }
}

module.exports = {
  listar,
  buscarPorId,
  crear,
  actualizar,
  eliminar,
}
