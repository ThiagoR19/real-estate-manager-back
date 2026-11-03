const db = require("../../db/conexion")

const SELECT_REPORTE = `
  SELECT
    r.id,
    r.id_inmobiliaria AS idInmobiliaria,
    r.id_propiedad AS idPropiedad,
    p.Nombre AS propiedad,
    r.id_categoria AS idCategoria,
    c.Nombre AS categoria,
    r.id_estado AS idEstado,
    e.Nombre AS estado,
    r.id_persona_reporta AS idPersonaReporta,
    CONCAT(persona.Nombre, ' ', persona.Apellido) AS personaReporta,
    r.id_profesional AS idProfesional,
    prof.Profesion AS profesion,
    r.Prioridad AS prioridad,
    r.\`Título\` AS titulo,
    r.\`Descripción\` AS descripcion,
    r.Fecha AS fecha,
    r.Archivado AS archivado,
    r.Fecha_archivo AS fechaArchivo,
    r.Motivo_archivo AS motivoArchivo,
    r.Activo AS activo,
    r.Fecha_baja AS fechaBaja,
    r.Motivo_baja AS motivoBaja
  FROM Reportes r
  INNER JOIN Propiedades p
    ON p.id = r.id_propiedad AND p.id_inmobiliaria = r.id_inmobiliaria
  INNER JOIN \`Categorías\` c ON c.id = r.id_categoria
  INNER JOIN Estados_reportes e ON e.id = r.id_estado
  INNER JOIN Personas persona
    ON persona.id = r.id_persona_reporta
    AND persona.id_inmobiliaria = r.id_inmobiliaria
  LEFT JOIN Profesionales prof
    ON prof.id = r.id_profesional
    AND prof.id_inmobiliaria = r.id_inmobiliaria
`

function alcance(usuario, valor) {
  return usuario && usuario.idInmobi !== undefined ? usuario.idInmobi : valor
}

function condiciones(usuario, valorInmobiliaria, busqueda, soloActivos = true) {
  const inmobiliaria = alcance(usuario, valorInmobiliaria)
  const filtros = []
  const parametros = []

  if (soloActivos) filtros.push("r.Activo = TRUE")
  if (inmobiliaria !== undefined && inmobiliaria !== null) {
    filtros.push("r.id_inmobiliaria = ?")
    parametros.push(inmobiliaria)
  }
  if (busqueda) {
    filtros.push("(r.`Título` LIKE ? OR r.`Descripción` LIKE ? OR r.Prioridad LIKE ?)")
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
       ORDER BY r.Fecha DESC, r.id DESC
       LIMIT ? OFFSET ?`,
      [...filtro.parametros, limite, offset]
    ),
    db.execute(
      `SELECT COUNT(*) AS total
       FROM Reportes r
       ${filtro.sql}`,
      filtro.parametros
    ),
  ])

  const total = Number(conteo[0][0].total)
  return {
    items: filas[0],
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
  return filas[0] || null
}

async function crear(usuario, cuerpo = {}) {
  const inmobiliaria = alcance(usuario, cuerpo.idInmobiliaria)
  const [personas] = await db.execute(
    `SELECT id_persona
     FROM Usuarios
     WHERE id = ? AND id_inmobiliaria = ?`,
    [usuario && usuario.id, inmobiliaria]
  )
  const idPersonaReporta = personas[0]?.id_persona ?? cuerpo.idPersonaReporta

  const [resultado] = await db.execute(
    `INSERT INTO Reportes
      (id_inmobiliaria, id_propiedad, id_categoria, id_estado,
       id_persona_reporta, id_profesional, Prioridad, \`Título\`,
       \`Descripción\`, Fecha, Archivado)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      cuerpo.archivado ?? false,
    ]
  )

  return buscarPorId(usuario, resultado.insertId)
}

async function actualizar(usuario, id, cuerpo = {}) {
  const campos = {
    idPropiedad: "id_propiedad",
    idCategoria: "id_categoria",
    idEstado: "id_estado",
    idProfesional: "id_profesional",
    prioridad: "Prioridad",
    titulo: "Título",
    descripcion: "Descripción",
    fecha: "Fecha",
    archivado: "Archivado",
    fechaArchivo: "Fecha_archivo",
    motivoArchivo: "Motivo_archivo",
    activo: "Activo",
    fechaBaja: "Fecha_baja",
    motivoBaja: "Motivo_baja",
  }
  const cambios = Object.entries(campos)
    .filter(([campo]) => Object.hasOwn(cuerpo, campo))

  const inmobiliaria = alcance(usuario)
  const parametros = cambios.map(([campo]) => cuerpo[campo])
  const where = ["id = ?"]
  parametros.push(id)

  if (inmobiliaria !== undefined && inmobiliaria !== null) {
    where.push("id_inmobiliaria = ?")
    parametros.push(inmobiliaria)
  }

  if (cambios.length) {
    await db.execute(
      `UPDATE Reportes
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
    where.push("id_inmobiliaria = ?")
    parametros.push(inmobiliaria)
  }

  const [resultado] = await db.execute(
    `DELETE FROM Reportes WHERE ${where.join(" AND ")}`,
    parametros
  )
  return resultado.affectedRows > 0
}

module.exports = { listar, buscarPorId, crear, actualizar, eliminar }
