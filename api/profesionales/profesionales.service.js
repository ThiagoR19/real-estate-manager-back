const db = require("../../db/conexion")
const { AGENTE } = require("../../config/roles")

function problema(codigo, mensaje = codigo) {
  return Object.assign(new Error(mensaje), { codigo })
}

const SELECT_PROFESIONAL = `
  SELECT
    pr.id,
    pr.idInmobiliaria,
    pr.idPersona,
    pr.profesion,
    p.nombre,
    p.apellido,
    p.correo,
    p.dni,
    p.telefono,
    p.direccion,
    COALESCE(valoraciones.ratingPromedio, 0) AS ratingPromedio,
    COALESCE(valoraciones.cantidadResenas, 0) AS cantidadResenas,
    votoActual.puntuacion AS miVoto
  FROM profesionales pr
  INNER JOIN personas p
    ON p.id = pr.idPersona
    AND p.idInmobiliaria = pr.idInmobiliaria
  LEFT JOIN (
    SELECT
      idInmobiliaria,
      idProfesional,
      AVG(puntuacion) AS ratingPromedio,
      COUNT(*) AS cantidadResenas
    FROM votosProfesionales
    GROUP BY idInmobiliaria, idProfesional
  ) valoraciones
    ON valoraciones.idProfesional = pr.id
    AND valoraciones.idInmobiliaria = pr.idInmobiliaria
  LEFT JOIN votosProfesionales votoActual
    ON votoActual.idProfesional = pr.id
    AND votoActual.idInmobiliaria = pr.idInmobiliaria
    AND votoActual.idUsuarioAgente = ?
`

function alcance(usuario, valor) {
  if (usuario && usuario.idInmobi !== undefined && usuario.idInmobi !== null) {
    return usuario.idInmobi
  }
  return valor
}

function condiciones(usuario, valorInmobiliaria, busqueda) {
  const idInmobiliaria = alcance(usuario, valorInmobiliaria)
  const filtros = []
  const parametros = []

  if (idInmobiliaria !== undefined && idInmobiliaria !== null) {
    filtros.push("pr.idInmobiliaria = ?")
    parametros.push(idInmobiliaria)
  }

  if (busqueda) {
    filtros.push(`(
      p.nombre LIKE ? OR p.apellido LIKE ? OR p.correo LIKE ? OR
      p.dni LIKE ? OR p.telefono LIKE ? OR pr.profesion LIKE ?
    )`)
    const texto = `%${busqueda}%`
    parametros.push(texto, texto, texto, texto, texto, texto)
  }

  return {
    sql: filtros.length ? ` WHERE ${filtros.join(" AND ")}` : "",
    parametros,
    idInmobiliaria,
  }
}

async function buscarPorIdConConexion(usuario, id, conexion) {
  const filtro = condiciones(usuario)
  const where = filtro.sql
    ? `${filtro.sql} AND pr.id = ?`
    : " WHERE pr.id = ?"
  const [filas] = await conexion.execute(
    `${SELECT_PROFESIONAL}${where}`,
    [usuario?.id ?? 0, ...filtro.parametros, id]
  )
  return filas[0] || null
}

async function listar(usuario, query = {}) {
  const filtro = condiciones(usuario, query.idInmobiliaria, query.q)
  const pagina = Math.max(1, Number.parseInt(query.page, 10) || 1)
  const limite = Math.min(10, Math.max(1, Number.parseInt(query.limit, 10) || 10))
  const offset = (pagina - 1) * limite

  const [filas, conteo] = await Promise.all([
    db.execute(
      `${SELECT_PROFESIONAL}
       ${filtro.sql}
       ORDER BY p.apellido, p.nombre, pr.id
       LIMIT ? OFFSET ?`,
      [usuario?.id ?? 0, ...filtro.parametros, limite, offset]
    ),
    db.execute(
      `SELECT COUNT(*) AS total
       FROM profesionales pr
       INNER JOIN personas p
         ON p.id = pr.idPersona
         AND p.idInmobiliaria = pr.idInmobiliaria
       ${filtro.sql}`,
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
  return buscarPorIdConConexion(usuario, id, db)
}

async function crear(usuario, cuerpo = {}) {
  const idInmobiliaria = alcance(usuario, cuerpo.idInmobiliaria)
  if (idInmobiliaria === undefined || idInmobiliaria === null) {
    throw problema("DATOS_INVALIDOS", "La inmobiliaria es obligatoria para crear un profesional")
  }

  const conexion = await db.getConnection()

  try {
    await conexion.beginTransaction()

    let idPersona = cuerpo.idPersona
    if (idPersona === undefined || idPersona === null) {
      const [persona] = await conexion.execute(
        `INSERT INTO personas (idInmobiliaria, nombre, apellido, correo, dni, telefono, direccion) VALUES (?, ?, ?, ?, ?, ?, ?)`,
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
         WHERE id = ? AND idInmobiliaria = ? FOR UPDATE`,
        [idPersona, idInmobiliaria]
      )
      if (!personas.length) {
        throw problema("NO_ENCONTRADO", "La persona indicada no existe en la inmobiliaria")
      }
      const [usos] = await conexion.execute(
        `SELECT (
           EXISTS (SELECT 1 FROM usuarios WHERE idPersona = ?)
           OR EXISTS (SELECT 1 FROM agentes WHERE idPersona = ?)
           OR EXISTS (SELECT 1 FROM propietarios WHERE idPersona = ?)
           OR EXISTS (SELECT 1 FROM inquilinos WHERE idPersona = ?)
           OR EXISTS (SELECT 1 FROM clientes WHERE idPersona = ?)
           OR EXISTS (SELECT 1 FROM profesionales WHERE idPersona = ?)
         ) AS ocupada`,
        [idPersona, idPersona, idPersona, idPersona, idPersona, idPersona]
      )
      if (usos[0]?.ocupada) {
        throw problema("CONFLICTO", "La persona ya está asociada a otra entidad")
      }
    }

    const [profesional] = await conexion.execute(
      `INSERT INTO profesionales (idInmobiliaria, idPersona, profesion)
       VALUES (?, ?, ?)`,
      [idInmobiliaria, idPersona, cuerpo.profesion]
    )

    await conexion.commit()
    return buscarPorId(usuario, profesional.insertId)
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

    const profesional = await buscarPorIdConConexion(usuario, id, conexion)
    if (!profesional) {
      await conexion.rollback()
      return null
    }

    const camposPersona = {
      nombre: "nombre",
      apellido: "apellido",
      correo: "correo",
      telefono: "telefono",
      direccion: "direccion",
    }
    const cambiosPersona = Object.entries(camposPersona)
      .filter(([campo]) => Object.prototype.hasOwnProperty.call(cuerpo, campo))

    if (cambiosPersona.length) {
      await conexion.execute(
        `UPDATE personas
         SET ${cambiosPersona.map(([, columna]) => `\`${columna}\` = ?`).join(", ")}
         WHERE id = ? AND idInmobiliaria = ?`,
        [
          ...cambiosPersona.map(([campo]) => cuerpo[campo]),
          profesional.idPersona,
          profesional.idInmobiliaria,
        ]
      )
    }

    if (Object.prototype.hasOwnProperty.call(cuerpo, "profesion")) {
      await conexion.execute(
        `UPDATE profesionales
         SET profesion = ?
         WHERE id = ? AND idInmobiliaria = ?`,
        [cuerpo.profesion, id, profesional.idInmobiliaria]
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
    const profesional = await buscarPorIdConConexion(usuario, id, conexion)
    if (!profesional) { await conexion.rollback(); return false }
    await conexion.execute(
      "UPDATE reportes SET idProfesional = NULL WHERE idProfesional = ? AND idInmobiliaria = ?",
      [id, profesional.idInmobiliaria]
    )
    await conexion.execute(
      "DELETE FROM valoracionesProfesionales WHERE idProfesional = ? AND idInmobiliaria = ?",
      [id, profesional.idInmobiliaria]
    )
    await conexion.execute(`DELETE FROM profesionales WHERE id = ? AND idInmobiliaria = ?`, [id, profesional.idInmobiliaria])
    await conexion.execute("SAVEPOINT profesional_eliminado")
    try {
      await conexion.execute(`DELETE FROM personas WHERE id = ? AND idInmobiliaria = ?`, [profesional.idPersona, profesional.idInmobiliaria])
    } catch (error) {
      if (!["ER_ROW_IS_REFERENCED_2", "ER_ROW_IS_REFERENCED"].includes(error.code)) throw error
      await conexion.execute("ROLLBACK TO SAVEPOINT profesional_eliminado")
    }
    await conexion.execute("RELEASE SAVEPOINT profesional_eliminado")
    await conexion.commit()
    return true
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}

async function valorar(usuario, id, puntuacion) {
  if (usuario?.rol !== AGENTE || !usuario.idInmobi) throw problema("SIN_PERMISO")

  try {
    const [resultado] = await db.execute(
      `INSERT INTO votosProfesionales (idInmobiliaria, idProfesional, idUsuarioAgente, puntuacion)
       SELECT pr.idInmobiliaria, pr.id, ?, ?
       FROM profesionales pr
       WHERE pr.id = ? AND pr.idInmobiliaria = ?`,
      [usuario.id, puntuacion, id, usuario.idInmobi]
    )
    if (!resultado.affectedRows) throw problema("NO_ENCONTRADO", "El profesional no existe en tu inmobiliaria")
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") throw problema("CONFLICTO", "Ya valoraste a este profesional")
    throw error
  }

  return buscarPorId(usuario, id)
}

module.exports = { listar, buscarPorId, crear, actualizar, eliminar, valorar }
