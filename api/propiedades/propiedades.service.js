const db = require("../../db/conexion")

const SELECT_PROPIEDAD = `
  SELECT
    p.id,
    p.id_inmobiliaria AS idInmobiliaria,
    p.id_estadoComercial AS idEstadoComercial,
    ec.Nombre AS estadoComercial,
    p.id_tipo AS idTipo,
    tp.Nombre AS tipo,
    p.id_agente AS idAgente,
    p.Nombre AS nombre,
    p.Descripción AS descripcion,
    p.Ubicación AS ubicacion,
    p.Precio AS precio,
    p.Moneda AS moneda,
    p.Publicada AS publicada,
    p.Tamaño AS tamano,
    p.Antigüedad AS antiguedad,
    p.Baños AS banos,
    p.Habitaciones AS habitaciones,
    p.Activo AS activo,
    p.Fecha_baja AS fechaBaja,
    p.Motivo_baja AS motivoBaja,
    p.Fecha_creacion AS fechaCreacion
  FROM Propiedades p
  INNER JOIN EstadosComerciales ec ON ec.id = p.id_estadoComercial
  INNER JOIN TiposPropiedades tp ON tp.id = p.id_tipo
`

function alcance(usuario, valor) {
  return usuario && usuario.idInmobi !== undefined ? usuario.idInmobi : valor
}

function condiciones(usuario, valorInmobiliaria, busqueda, soloActivas = true) {
  const inmobiliaria = alcance(usuario, valorInmobiliaria)
  const filtros = []
  const parametros = []

  if (soloActivas) filtros.push("p.Activo = TRUE")
  if (inmobiliaria !== undefined && inmobiliaria !== null) {
    filtros.push("p.id_inmobiliaria = ?")
    parametros.push(inmobiliaria)
  }
  if (busqueda) {
    filtros.push("(p.Nombre LIKE ? OR p.`Ubicación` LIKE ? OR p.`Descripción` LIKE ?)")
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
      `${SELECT_PROPIEDAD}
       ${filtro.sql}
       ORDER BY p.Fecha_creacion DESC
       LIMIT ? OFFSET ?`,
      [...filtro.parametros, limite, offset]
    ),
    db.execute(
      `SELECT COUNT(*) AS total
       FROM Propiedades p
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
  const filtro = condiciones(usuario, undefined, undefined)
  const where = filtro.sql
    ? `${filtro.sql} AND p.id = ?`
    : " WHERE p.id = ?"
  const [filas] = await db.execute(
    `${SELECT_PROPIEDAD}${where}`,
    [...filtro.parametros, id]
  )
  return filas[0] || null
}

async function crear(usuario, cuerpo = {}) {
  const inmobiliaria = alcance(usuario, cuerpo.idInmobiliaria)
  const [resultado] = await db.execute(
    `INSERT INTO Propiedades
      (id_inmobiliaria, id_estadoComercial, id_tipo, id_agente,
       Nombre, Descripción, Ubicación, Precio, Moneda, Publicada,
       Tamaño, Antigüedad, Baños, Habitaciones)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      inmobiliaria,
      cuerpo.idEstadoComercial,
      cuerpo.idTipo,
      cuerpo.idAgente ?? null,
      cuerpo.nombre,
      cuerpo.descripcion ?? null,
      cuerpo.ubicacion ?? null,
      cuerpo.precio ?? null,
      cuerpo.moneda ?? "ARS",
      cuerpo.publicada ?? false,
      cuerpo.tamano ?? null,
      cuerpo.antiguedad ?? null,
      cuerpo.banos ?? null,
      cuerpo.habitaciones ?? null,
    ]
  )

  return buscarPorId(usuario, resultado.insertId)
}

async function actualizar(usuario, id, cuerpo = {}) {
  const campos = {
    idEstadoComercial: "id_estadoComercial",
    idTipo: "id_tipo",
    idAgente: "id_agente",
    nombre: "Nombre",
    descripcion: "Descripción",
    ubicacion: "Ubicación",
    precio: "Precio",
    moneda: "Moneda",
    publicada: "Publicada",
    tamano: "Tamaño",
    antiguedad: "Antigüedad",
    banos: "Baños",
    habitaciones: "Habitaciones",
  }
  const cambios = Object.entries(campos).filter(([campo]) => Object.prototype.hasOwnProperty.call(cuerpo, campo))
  const inmobiliaria = alcance(usuario)
  const parametros = cambios.map(([campo]) => cuerpo[campo])
  const where = ["id = ?"]
  parametros.push(id)

  if (inmobiliaria !== undefined && inmobiliaria !== null) { where.push("id_inmobiliaria = ?"); parametros.push(inmobiliaria) }

  if (cambios.length) {
    await db.execute(`UPDATE Propiedades SET ${cambios.map(([, columna]) => `\`${columna}\` = ?`).join(", ")} WHERE ${where.join(" AND ")}`, parametros)
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

  const [resultado] = await db.execute(`DELETE FROM Propiedades WHERE ${where.join(" AND ")}`, parametros)

  return resultado.affectedRows > 0
}

module.exports = { listar, buscarPorId, crear, actualizar, eliminar }
