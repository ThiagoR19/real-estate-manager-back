const bcrypt = require("bcrypt")
const db = require("../../db/conexion")
const AppError = require("../../utils/app-error")
const { crearEnlaceActivacion, crearTokenActivacion } = require("../../utils/activacion")
const { SUPERADMIN, ADMIN, AGENTE } = require("../../config/roles")
const {
  validarCrearCuenta,
  validarActualizarCuenta,
  validarIdRecurso,
  validarListado,
} = require("../../utils/cuenta-validation")

const SALT_ROUNDS = Number(process.env.SALT_ROUNDS) || 10

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

function condicionesAgente({ idInmobiliaria, busqueda, soloActivos = false }) {
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

async function listarAgentes({ idInmobiliaria, busqueda, limite, offset }) {
  const filtro = condicionesAgente({ idInmobiliaria, busqueda })
  const [filas] = await db.execute(
    `${SELECT_AGENTE}
     WHERE ${filtro.filtros.join(" AND ")}
     ORDER BY p.Apellido ASC, p.Nombre ASC
     LIMIT ? OFFSET ?`,
    [...filtro.parametros, limite, offset]
  )

  return filas
}

async function contarAgentes({ idInmobiliaria, busqueda }) {
  const filtro = condicionesAgente({ idInmobiliaria, busqueda })
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

async function buscarAgentePorId(id, idInmobiliaria) {
  const filtro = condicionesAgente({ idInmobiliaria })
  const [filas] = await db.execute(
    `${SELECT_AGENTE}
     WHERE a.id = ? AND ${filtro.filtros.join(" AND ")}`,
    [id, ...filtro.parametros]
  )

  return filas[0] || null
}

async function crearAgente(datos) {
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

async function actualizarAgente(id, idInmobiliaria, datos) {
  const conexion = await db.getConnection()

  try {
    await conexion.beginTransaction()

    const filtro = condicionesAgente({ idInmobiliaria })
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

async function cambiarRolAgente(id, idRol, idInmobiliaria) {
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

async function eliminarAgente(id, idInmobiliaria) {
  const conexion = await db.getConnection()

  try {
    await conexion.beginTransaction()

    const filtro = condicionesAgente({ idInmobiliaria })
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

function obtenerAlcance(usuario, valor) {
  if (usuario.rol === SUPERADMIN) {
    if (valor === undefined || valor === null || valor === "") return null
    return validarIdRecurso(valor, "idInmobiliaria")
  }

  return obtenerIdInmobiliaria(usuario)
}

function validarRol(valor) {
  const roles = {
    [String(ADMIN)]: ADMIN,
    [String(AGENTE)]: AGENTE,
    ADMIN,
    AGENTE,
  }
  const rol = roles[String(valor).toUpperCase()]

  if (!rol) {
    throw new AppError("DATOS_INVALIDOS", "El rol debe ser ADMIN o AGENTE")
  }

  return rol
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
    return new AppError("DATOS_INVALIDOS", "La inmobiliaria o el área indicada no existe")
  }

  return error
}

async function listar(usuario, query) {
  const filtros = validarListado(query)
  const idInmobiliaria = obtenerAlcance(usuario, query.idInmobiliaria)

  try {
    const parametros = { ...filtros, idInmobiliaria }
    const [items, total] = await Promise.all([
      listarAgentes(parametros),
      contarAgentes(parametros),
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
  const id = validarIdRecurso(valorId, "id")
  const idInmobiliaria = obtenerAlcance(usuario)

  try {
    const agente = await buscarAgentePorId(id, idInmobiliaria)

    if (!agente) throw new AppError("NO_ENCONTRADO", "El agente no existe")
    return agente
  } catch (error) {
    throw traducirError(error)
  }
}

async function crear(usuario, cuerpo) {
  const datos = validarCrearCuenta(cuerpo)
  datos.idInmobiliaria = usuario.rol === SUPERADMIN
    ? validarIdRecurso(datos.idInmobiliaria, "idInmobiliaria")
    : obtenerIdInmobiliaria(usuario)

  if (Object.prototype.hasOwnProperty.call(cuerpo, "idArea")) {
    datos.idArea = cuerpo.idArea === null || cuerpo.idArea === ""
      ? null
      : validarIdRecurso(cuerpo.idArea, "idArea")
  } else {
    datos.idArea = null
  }

  datos.password = await bcrypt.hash(datos.password, SALT_ROUNDS)

  try {
    const cuenta = await crearAgente(datos)
    const agente = await buscarAgentePorId(cuenta.id, datos.idInmobiliaria)

    return {
      ...agente,
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
  const id = validarIdRecurso(valorId, "id")
  const idInmobiliaria = obtenerAlcance(usuario)
  const datos = validarActualizarCuenta(cuerpo, { permiteArea: true })

  if (datos.password !== undefined) {
    datos.password = await bcrypt.hash(datos.password, SALT_ROUNDS)
  }

  try {
    const actualizado = await actualizarAgente(id, idInmobiliaria, datos)

    if (!actualizado) throw new AppError("NO_ENCONTRADO", "El agente no existe")
    return buscarAgentePorId(id, idInmobiliaria)
  } catch (error) {
    throw traducirError(error)
  }
}

async function cambiarRol(usuario, valorId, valorRol) {
  const id = validarIdRecurso(valorId, "id")
  const rol = validarRol(valorRol)
  const idInmobiliaria = obtenerAlcance(usuario)

  try {
    const actualizado = await cambiarRolAgente(id, rol, idInmobiliaria)

    if (!actualizado) throw new AppError("NO_ENCONTRADO", "El agente no existe")
    return { id, rol }
  } catch (error) {
    throw traducirError(error)
  }
}

async function eliminar(usuario, valorId) {
  const id = validarIdRecurso(valorId, "id")
  const idInmobiliaria = obtenerAlcance(usuario)

  try {
    const eliminado = await eliminarAgente(id, idInmobiliaria)

    if (!eliminado) throw new AppError("NO_ENCONTRADO", "El agente no existe")
  } catch (error) {
    throw traducirError(error)
  }
}

module.exports = {
  listar,
  buscarPorId,
  crear,
  actualizar,
  cambiarRol,
  eliminar,
}
