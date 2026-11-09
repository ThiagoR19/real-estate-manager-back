const bcrypt = require("bcrypt")
const db = require("../../db/conexion")
const adjuntos = require("../archivos/archivos.service")
const { crearEnlaceActivacion, crearTokenActivacion } = require("../../utils/activacion")
const { SUPERADMIN, PROPIETARIO } = require("../../config/roles")
const { saltRounds } = require("../../config/env")

const SELECT_PROPIETARIO = `
  SELECT
    pr.id,
    pr.idInmobiliaria,
    pr.idPersona,
    pr.cbu,
    pr.alias,
    pr.activo,
    u.id AS idUsuario,
    u.usuario,
    CASE
      WHEN u.fechaActivacion IS NULL THEN 'PENDIENTE_ACTIVACION'
      ELSE 'ACTIVO'
    END AS estadoCuenta,
    p.nombre,
    p.apellido,
    p.correo,
    p.dni,
    p.telefono,
    p.direccion,
    p.fotoPerfil
  FROM propietarios pr
  INNER JOIN personas p
    ON p.id = pr.idPersona
    AND p.idInmobiliaria = pr.idInmobiliaria
  INNER JOIN usuarios u
    ON u.idPersona = p.id
    AND u.idInmobiliaria = pr.idInmobiliaria
`

function alcance(usuario, valor) {
  if (usuario?.rol === SUPERADMIN) {
    return valor ?? null
  }

  if (usuario?.idInmobi === undefined || usuario.idInmobi === null) {
    throw new Error("La inmobiliaria del usuario es obligatoria")
  }

  return usuario.idInmobi
}

function tiene(cuerpo, campo) {
  return Object.prototype.hasOwnProperty.call(cuerpo, campo)
}

function filtro(usuario, valorInmobiliaria, busqueda) {
  const idInmobiliaria = alcance(usuario, valorInmobiliaria)
  const condiciones = ["u.idRol = ?"]
  const parametros = [PROPIETARIO]

  if (idInmobiliaria !== null) {
    condiciones.push("pr.idInmobiliaria = ?")
    parametros.push(idInmobiliaria)
  }

  if (busqueda) {
    condiciones.push(`(
      p.nombre LIKE ? OR p.apellido LIKE ? OR p.correo LIKE ? OR
      p.dni LIKE ? OR p.telefono LIKE ? OR u.usuario LIKE ? OR
      pr.cbu LIKE ? OR pr.alias LIKE ?
    )`)
    const texto = `%${busqueda}%`
    parametros.push(texto, texto, texto, texto, texto, texto, texto, texto)
  }

  return { idInmobiliaria, sql: condiciones.join(" AND "), parametros }
}

async function buscarPorIdConConexion(usuario, id, conexion) {
  const condiciones = filtro(usuario)
  const [filas] = await conexion.execute(
    `${SELECT_PROPIETARIO} WHERE pr.id = ? AND ${condiciones.sql}`,
    [id, ...condiciones.parametros]
  )
  return adjuntos.incluirFotoPerfil(filas[0] || null)
}

async function buscarPorId(usuario, id) {
  return buscarPorIdConConexion(usuario, id, db)
}

async function listar(usuario, query = {}) {
  const condiciones = filtro(usuario, query.idInmobiliaria, query.q)
  const pagina = Math.max(1, Number.parseInt(query.page, 10) || 1)
  const limite = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20))
  const offset = (pagina - 1) * limite

  const [filas, conteo] = await Promise.all([
    db.execute(
      `${SELECT_PROPIETARIO}
       WHERE ${condiciones.sql}
       ORDER BY p.apellido, p.nombre, pr.id
       LIMIT ? OFFSET ?`,
      [...condiciones.parametros, limite, offset]
    ),
    db.execute(
      `SELECT COUNT(*) AS total
       FROM propietarios pr
       INNER JOIN personas p
         ON p.id = pr.idPersona
         AND p.idInmobiliaria = pr.idInmobiliaria
       INNER JOIN usuarios u
         ON u.idPersona = p.id
         AND u.idInmobiliaria = pr.idInmobiliaria
       WHERE ${condiciones.sql}`,
      condiciones.parametros
    ),
  ])

  const total = Number(conteo[0][0].total)
  return {
    items: filas[0].map(adjuntos.incluirFotoPerfil),
    paginacion: {
      pagina,
      limite,
      total,
      paginas: Math.ceil(total / limite),
    },
  }
}

async function crear(usuario, cuerpo = {}) {
  const idInmobiliaria = alcance(usuario, cuerpo.idInmobiliaria)
  if (idInmobiliaria === null) {
    throw new Error("La inmobiliaria es obligatoria para crear un propietario")
  }

  const passwordHash = await bcrypt.hash(cuerpo.password, saltRounds)
  const activacion = crearTokenActivacion()
  const conexion = await db.getConnection()

  try {
    await conexion.beginTransaction()

    let idPersona = cuerpo.idPersona
    if (idPersona === undefined || idPersona === null) {
      const [persona] = await conexion.execute(
        `INSERT INTO personas
          (idInmobiliaria, nombre, apellido, correo, dni, telefono, direccion)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          idInmobiliaria,
          cuerpo.nombre,
          cuerpo.apellido,
          cuerpo.correo ?? null,
          cuerpo.dni ?? null,
          cuerpo.telefono ?? null,
          cuerpo.direccion ?? null,
        ]
      )
      idPersona = persona.insertId
    } else {
      const [personas] = await conexion.execute(
        `SELECT id
         FROM personas
         WHERE id = ? AND idInmobiliaria = ?`,
        [idPersona, idInmobiliaria]
      )
      if (!personas.length) {
        throw new Error("La persona indicada no existe en la inmobiliaria")
      }
    }

    const [usuarioCreado] = await conexion.execute(
      `INSERT INTO usuarios
        (idInmobiliaria, idPersona, usuario, passwordHash, idRol)
       VALUES (?, ?, ?, ?, ?)`,
      [idInmobiliaria, idPersona, cuerpo.usuario, passwordHash, PROPIETARIO]
    )

    await conexion.execute(
      `INSERT INTO tokensAcceso
        (idUsuario, tokenHash, proposito, fechaExpiracion)
       VALUES (?, ?, 'ACTIVACION', ?)`,
      [usuarioCreado.insertId, activacion.hash, activacion.fechaExpiracion]
    )

    const [propietario] = await conexion.execute(
      `INSERT INTO propietarios
        (idInmobiliaria, idPersona, cbu, alias, activo)
       VALUES (?, ?, ?, ?, ?)`,
      [
        idInmobiliaria,
        idPersona,
        cuerpo.cbu ?? null,
        cuerpo.alias ?? null,
        cuerpo.activo ?? true,
      ]
    )

    await conexion.commit()
    return {
      ...(await buscarPorId(usuario, propietario.insertId)),
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
    const propietario = await buscarPorIdConConexion(usuario, id, conexion)

    if (!propietario) {
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
      .filter(([campo]) => tiene(cuerpo, campo))

    if (cambiosPersona.length) {
      await conexion.execute(
        `UPDATE personas
         SET ${cambiosPersona.map(([, columna]) => `\`${columna}\` = ?`).join(", ")}
         WHERE id = ? AND idInmobiliaria = ?`,
        [
          ...cambiosPersona.map(([campo]) => cuerpo[campo]),
          propietario.idPersona,
          propietario.idInmobiliaria,
        ]
      )
    }

    const cambiosUsuario = []
    if (tiene(cuerpo, "usuario")) {
      cambiosUsuario.push(["usuario", cuerpo.usuario])
    }
    if (tiene(cuerpo, "password")) {
      cambiosUsuario.push(["passwordHash", await bcrypt.hash(cuerpo.password, saltRounds)])
    }

    if (cambiosUsuario.length) {
      await conexion.execute(
        `UPDATE usuarios
         SET ${cambiosUsuario.map(([columna]) => `\`${columna}\` = ?`).join(", ")}
         WHERE id = ? AND idInmobiliaria = ? AND idRol = ?`,
        [
          ...cambiosUsuario.map(([, valor]) => valor),
          propietario.idUsuario,
          propietario.idInmobiliaria,
          PROPIETARIO,
        ]
      )
    }

    const camposPropietario = {
      cbu: "cbu",
      alias: "alias",
      activo: "activo",
    }
    const cambiosPropietario = Object.entries(camposPropietario)
      .filter(([campo]) => tiene(cuerpo, campo))

    if (cambiosPropietario.length) {
      await conexion.execute(
        `UPDATE propietarios
         SET ${cambiosPropietario.map(([, columna]) => `\`${columna}\` = ?`).join(", ")}
         WHERE id = ? AND idInmobiliaria = ?`,
        [
          ...cambiosPropietario.map(([campo]) => cuerpo[campo]),
          id,
          propietario.idInmobiliaria,
        ]
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

async function eliminar(usuario, id) {
  const conexion = await db.getConnection()

  try {
    await conexion.beginTransaction()
    const propietario = await buscarPorIdConConexion(usuario, id, conexion)

    if (!propietario) {
      await conexion.rollback()
      return false
    }

    const archivosEliminar = await adjuntos.prepararEliminacion(conexion, "persona", propietario)
    await conexion.execute(
      "DELETE FROM tokensAcceso WHERE idUsuario = ?",
      [propietario.idUsuario]
    )
    await conexion.execute(
      "DELETE FROM propietarios WHERE id = ? AND idInmobiliaria = ?",
      [id, propietario.idInmobiliaria]
    )
    await conexion.execute(
      "DELETE FROM usuarios WHERE id = ? AND idInmobiliaria = ? AND idRol = ?",
      [propietario.idUsuario, propietario.idInmobiliaria, PROPIETARIO]
    )
    await conexion.execute(
      "DELETE FROM personas WHERE id = ? AND idInmobiliaria = ?",
      [propietario.idPersona, propietario.idInmobiliaria]
    )

    await conexion.commit()
    await adjuntos.limpiar(archivosEliminar)
    return true
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}

module.exports = { listar, buscarPorId, crear, actualizar, eliminar }
