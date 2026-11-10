const db = require("../../db/conexion")
const adjuntos = require("../archivos/archivos.service")

const SELECT_REPORTE = `
  SELECT
    r.id,
    r.idInmobiliaria,
    r.idPropiedad,
    p.nombre AS propiedad,
    r.idCategoria,
    c.nombre AS categoria,
    r.idEstado,
    e.nombre AS estado,
    r.idPersonaReporta,
    CONCAT(persona.nombre, ' ', persona.apellido) AS personaReporta,
    r.idProfesional,
    prof.profesion,
    r.prioridad,
    r.titulo,
    r.descripcion,
    r.fecha
  FROM reportes r
  INNER JOIN propiedades p
    ON p.id = r.idPropiedad AND p.idInmobiliaria = r.idInmobiliaria
  INNER JOIN categorias c ON c.id = r.idCategoria
  INNER JOIN estadosReportes e ON e.id = r.idEstado
  INNER JOIN personas persona
    ON persona.id = r.idPersonaReporta
    AND persona.idInmobiliaria = r.idInmobiliaria
  LEFT JOIN profesionales prof
    ON prof.id = r.idProfesional
    AND prof.idInmobiliaria = r.idInmobiliaria
`

function alcance(usuario, valor) {
  return usuario && usuario.idInmobi !== undefined ? usuario.idInmobi : valor
}

function condiciones(usuario, valorInmobiliaria, busqueda) {
  const inmobiliaria = alcance(usuario, valorInmobiliaria)
  const filtros = []
  const parametros = []

  if (inmobiliaria !== undefined && inmobiliaria !== null) {
    filtros.push("r.idInmobiliaria = ?")
    parametros.push(inmobiliaria)
  }
  if (busqueda) {
    filtros.push("(r.titulo LIKE ? OR r.descripcion LIKE ? OR r.prioridad LIKE ?)")
    const texto = `%${busqueda}%`
    parametros.push(texto, texto, texto)
  }

  return {
    sql: filtros.length ? ` WHERE ${filtros.join(" AND ")}` : "",
    parametros,
    inmobiliaria,
  }
}

async function listar(usuario, query = {}) {
  const filtro = condiciones(usuario, query.idInmobiliaria, query.q)
  const pagina = Number(query.page || 1)
  const limite = Number(query.limit || 20)
  const offset = (pagina - 1) * limite

  const [filas, conteo] = await Promise.all([
    db.execute(
      `${SELECT_REPORTE}
       ${filtro.sql}
       ORDER BY r.fecha DESC, r.id DESC
       LIMIT ? OFFSET ?`,
      [...filtro.parametros, limite, offset]
    ),
    db.execute(
      `SELECT COUNT(*) AS total
       FROM reportes r
       ${filtro.sql}`,
      filtro.parametros
    ),
  ])

  const total = Number(conteo[0][0].total)
  const items = await adjuntos.incluirImagenes("reporte", filas[0])
  return {
    items,
    paginacion: { pagina, limite, total, paginas: Math.ceil(total / limite) },
  }
}

async function buscarPorId(usuario, id) {
  const filtro = condiciones(usuario)
  const where = filtro.sql
    ? `${filtro.sql} AND r.id = ?`
    : " WHERE r.id = ?"
  const [filas] = await db.execute(
    `${SELECT_REPORTE}${where}`,
    [...filtro.parametros, id]
  )
  if (!filas.length) return null
  const [reporte] = await adjuntos.incluirImagenes("reporte", filas)
  return reporte
}

async function crear(usuario, cuerpo = {}) {
  const inmobiliaria = alcance(usuario, cuerpo.idInmobiliaria)
  const [personas] = await db.execute(
    `SELECT idPersona
     FROM usuarios
     WHERE id = ? AND idInmobiliaria = ?`,
    [usuario && usuario.id, inmobiliaria]
  )
  const idPersonaReporta = personas[0]?.idPersona ?? cuerpo.idPersonaReporta

  const [resultado] = await db.execute(
    `INSERT INTO reportes
      (idInmobiliaria, idPropiedad, idCategoria, idEstado,
       idPersonaReporta, idProfesional, prioridad, titulo,
       descripcion, fecha)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      inmobiliaria,
      cuerpo.idPropiedad,
      cuerpo.idCategoria,
      cuerpo.idEstado,
      idPersonaReporta,
      cuerpo.idProfesional ?? null,
      cuerpo.prioridad ?? "MEDIA",
      cuerpo.titulo,
      cuerpo.descripcion ?? null,
      cuerpo.fecha,
    ]
  )

  return buscarPorId(usuario, resultado.insertId)
}

async function actualizar(usuario, id, cuerpo = {}) {
  const campos = {
    idPropiedad: "idPropiedad",
    idCategoria: "idCategoria",
    idEstado: "idEstado",
    idProfesional: "idProfesional",
    prioridad: "prioridad",
    titulo: "titulo",
    descripcion: "descripcion",
    fecha: "fecha",
  }
  const cambios = Object.entries(campos)
    .filter(([campo]) => Object.hasOwn(cuerpo, campo))

  const inmobiliaria = alcance(usuario)
  const parametros = cambios.map(([campo]) => cuerpo[campo])
  const where = ["id = ?"]
  parametros.push(id)

  if (inmobiliaria !== undefined && inmobiliaria !== null) {
    where.push("idInmobiliaria = ?")
    parametros.push(inmobiliaria)
  }

  if (cambios.length) {
    await db.execute(
      `UPDATE reportes
       SET ${cambios.map(([, columna]) => `\`${columna}\` = ?`).join(", ")}
       WHERE ${where.join(" AND ")}`,
      parametros
    )
  }

  return buscarPorId(usuario, id)
}

async function eliminar(usuario, id) {
  const inmobiliaria = alcance(usuario)
  const parametros = [id]
  const where = ["id = ?"]

  if (inmobiliaria !== undefined && inmobiliaria !== null) {
    where.push("idInmobiliaria = ?")
    parametros.push(inmobiliaria)
  }

  const conexion = await db.getConnection()
  try {
    await conexion.beginTransaction()
    const [filas] = await conexion.execute(`SELECT id, idInmobiliaria FROM reportes WHERE ${where.join(" AND ")} FOR UPDATE`, parametros)
    if (!filas.length) { await conexion.rollback(); return false }
    const archivosEliminar = await adjuntos.prepararEliminacion(conexion, "reporte", filas[0])
    await conexion.execute(`DELETE FROM reportes WHERE ${where.join(" AND ")}`, parametros)
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

async function contarSinResolver(idInmobiliaria) {
  const [filas] = await db.execute(
    `SELECT COUNT(*) AS total
     FROM reportes r
     INNER JOIN estadosReportes e ON e.id = r.idEstado
     WHERE r.idInmobiliaria = ?
       AND e.nombre <> 'Resuelto'`,
    [idInmobiliaria]
  )
  return Number(filas[0].total)
}

async function listarSinRevisar(idInmobiliaria, limite = 5) {
  const [[filas], [conteo]] = await Promise.all([
    db.execute(
      `SELECT
         r.id,
         r.titulo,
         r.prioridad,
         r.fecha,
         r.idPropiedad,
         p.nombre AS propiedad,
         r.idPersonaReporta,
         CONCAT(persona.nombre, ' ', persona.apellido) AS personaReporta,
         (
           SELECT ri.nombre
           FROM reportesImagenes ri
           WHERE ri.idReporte = r.id
             AND ri.idInmobiliaria = r.idInmobiliaria
           ORDER BY ri.id
           LIMIT 1
         ) AS imagen
       FROM reportes r
       INNER JOIN estadosReportes e ON e.id = r.idEstado
       INNER JOIN propiedades p
         ON p.id = r.idPropiedad AND p.idInmobiliaria = r.idInmobiliaria
       INNER JOIN personas persona
         ON persona.id = r.idPersonaReporta
         AND persona.idInmobiliaria = r.idInmobiliaria
       WHERE r.idInmobiliaria = ?
         AND e.nombre = 'Abierto'
       ORDER BY r.fecha DESC, r.id DESC
       LIMIT ?`,
      [idInmobiliaria, limite]
    ),
    db.execute(
      `SELECT COUNT(*) AS total
       FROM reportes r
       INNER JOIN estadosReportes e ON e.id = r.idEstado
       WHERE r.idInmobiliaria = ?
         AND e.nombre = 'Abierto'`,
      [idInmobiliaria]
    ),
  ])

  return { total: Number(conteo[0].total), items: filas }
}

async function listarDePropiedades(idInmobiliaria, idsPropiedades, limite = 5, { soloSinRevisar = false } = {}) {
  if (!idsPropiedades.length) {
    return { total: 0, items: [] }
  }
  const enPropiedades = `r.idPropiedad IN (${idsPropiedades.map(() => "?").join(", ")})${soloSinRevisar ? " AND e.nombre = 'Abierto'" : ""}`

  const [[filas], [conteo]] = await Promise.all([
    db.execute(
      `SELECT
         r.id,
         r.titulo,
         r.prioridad,
         r.fecha,
         e.nombre AS estado,
         r.idPropiedad,
         p.nombre AS propiedad,
         CONCAT(persona.nombre, ' ', persona.apellido) AS personaReporta,
         (
           SELECT ri.nombre
           FROM reportesImagenes ri
           WHERE ri.idReporte = r.id
             AND ri.idInmobiliaria = r.idInmobiliaria
           ORDER BY ri.id
           LIMIT 1
         ) AS imagen
       FROM reportes r
       INNER JOIN estadosReportes e ON e.id = r.idEstado
       INNER JOIN propiedades p
         ON p.id = r.idPropiedad AND p.idInmobiliaria = r.idInmobiliaria
       INNER JOIN personas persona
         ON persona.id = r.idPersonaReporta
         AND persona.idInmobiliaria = r.idInmobiliaria
       WHERE r.idInmobiliaria = ?
         AND ${enPropiedades}
       ORDER BY r.fecha DESC, r.id DESC
       LIMIT ?`,
      [idInmobiliaria, ...idsPropiedades, limite]
    ),
    db.execute(
      `SELECT COUNT(*) AS total
       FROM reportes r
       INNER JOIN estadosReportes e ON e.id = r.idEstado
       WHERE r.idInmobiliaria = ?
         AND ${enPropiedades}`,
      [idInmobiliaria, ...idsPropiedades]
    ),
  ])

  return { total: Number(conteo[0].total), items: filas }
}

module.exports = { listar, buscarPorId, crear, actualizar, eliminar, contarSinResolver, listarSinRevisar, listarDePropiedades }
