const db = require("../../db/conexion")
const adjuntos = require("../archivos/archivos.service")

async function catalogos(usuario) {
  const [tipos, estados, agentes] = await Promise.all([
    db.execute("SELECT id, nombre FROM tiposPropiedades ORDER BY nombre"),
    db.execute("SELECT id, nombre FROM estadosComerciales ORDER BY id"),
    db.execute(`SELECT a.id, CONCAT(p.nombre, ' ', p.apellido) AS nombre
      FROM agentes a INNER JOIN personas p ON p.id = a.idPersona AND p.idInmobiliaria = a.idInmobiliaria
      WHERE a.idInmobiliaria = ? ORDER BY p.apellido, p.nombre`, [usuario.idInmobi]),
  ])
  return { tipos: tipos[0], estados: estados[0], agentes: agentes[0] }
}

const SELECT_PROPIEDAD = `
  SELECT
    p.id,
    p.idInmobiliaria,
    p.idEstadoComercial,
    ec.nombre AS estadoComercial,
    p.idTipo,
    tp.nombre AS tipo,
    p.idAgente,
    p.nombre,
    p.descripcion,
    p.ubicacion,
    p.precio,
    p.moneda,
    p.publicada,
    p.tamanio AS tamano,
    p.antiguedad,
    p.banios AS banos,
    p.habitaciones,
    p.fechaCreacion
  FROM propiedades p
  INNER JOIN estadosComerciales ec ON ec.id = p.idEstadoComercial
  INNER JOIN tiposPropiedades tp ON tp.id = p.idTipo
`

function alcance(usuario, valor) {
  if (usuario && usuario.idInmobi !== undefined) {
    return usuario.idInmobi
  }
  return valor
}

function condiciones(usuario, valorInmobiliaria, busqueda) {
  const inmobiliaria = alcance(usuario, valorInmobiliaria)

  const filtros = []
  const parametros = []

  if (inmobiliaria !== undefined && inmobiliaria !== null) {
    filtros.push("p.idInmobiliaria = ?")
    parametros.push(inmobiliaria)
  }

  if (busqueda) {
    filtros.push("(p.nombre LIKE ? OR p.ubicacion LIKE ? OR p.descripcion LIKE ?)")
    const texto = `%${busqueda}%`
    parametros.push(texto, texto, texto)
  }

  return {
    sql: filtros.length ? ` WHERE ${filtros.join(" AND ")}` : "",
    parametros,
    inmobiliaria,
  }
}

async function incluirImagenes(propiedades) {
  if (!propiedades.length) return propiedades

  const ids = propiedades.map((propiedad) => propiedad.id)
  const inmobiliarias = [...new Set(propiedades.map((propiedad) => propiedad.idInmobiliaria))]
  const [imagenes] = await db.execute(
    `SELECT id, idInmobiliaria, idPropiedad, nombre, orden
     FROM propiedadesImagenes
     WHERE idPropiedad IN (${ids.map(() => "?").join(", ")})
       AND idInmobiliaria IN (${inmobiliarias.map(() => "?").join(", ")})
     ORDER BY idPropiedad, orden, id`,
    [...ids, ...inmobiliarias]
  )

  const porPropiedad = new Map(propiedades.map((propiedad) => [
    `${propiedad.idInmobiliaria}:${propiedad.id}`, propiedad,
  ]))
  for (const propiedad of propiedades) propiedad.imagenes = []
  for (const { idInmobiliaria, idPropiedad, ...imagen } of imagenes) {
    const propiedad = porPropiedad.get(`${idInmobiliaria}:${idPropiedad}`)
    if (propiedad) {
      propiedad.imagenes.push({ ...imagen, url: `/uploads/propiedades/${imagen.nombre}` })
    }
  }
  return propiedades
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
       ORDER BY p.fechaCreacion DESC
       LIMIT ? OFFSET ?`,
      [...filtro.parametros, limite, offset]
    ),
    db.execute(
      `SELECT COUNT(*) AS total
       FROM propiedades p
       ${filtro.sql}`,
      filtro.parametros
    ),
  ])

  const total = Number(conteo[0][0].total)
  const items = await incluirImagenes(filas[0])
  return {
    items,
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
  const where = filtro.sql ? `${filtro.sql} AND p.id = ?` : " WHERE p.id = ?"

  const [filas] = await db.execute(
    `${SELECT_PROPIEDAD}${where}`,
    [...filtro.parametros, id]
  )

  if (!filas.length) return null
  const [propiedad] = await incluirImagenes(filas)
  return propiedad
}

async function crear(usuario, cuerpo = {}) {
  const inmobiliaria = alcance(usuario, cuerpo.idInmobiliaria)
  const [resultado] = await db.execute(
    `INSERT INTO propiedades
      (idInmobiliaria, idEstadoComercial, idTipo, idAgente,
       nombre, descripcion, ubicacion, precio, moneda, publicada,
       tamanio, antiguedad, banios, habitaciones)
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
    idEstadoComercial: "idEstadoComercial",
    idTipo: "idTipo",
    idAgente: "idAgente",
    nombre: "nombre",
    descripcion: "descripcion",
    ubicacion: "ubicacion",
    precio: "precio",
    moneda: "moneda",
    publicada: "publicada",
    tamano: "tamanio",
    antiguedad: "antiguedad",
    banos: "banios",
    habitaciones: "habitaciones",
  }
  const cambios = Object.entries(campos).filter(([campo]) => Object.prototype.hasOwnProperty.call(cuerpo, campo))
  const inmobiliaria = alcance(usuario)
  const parametros = cambios.map(([campo]) => cuerpo[campo])
  const where = ["id = ?"]
  parametros.push(id)

  if (inmobiliaria !== undefined && inmobiliaria !== null) { where.push("idInmobiliaria = ?"); parametros.push(inmobiliaria) }

  if (cambios.length) {
    await db.execute(`UPDATE propiedades SET ${cambios.map(([, columna]) => `\`${columna}\` = ?`).join(", ")} WHERE ${where.join(" AND ")}`, parametros)
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
    const [filas] = await conexion.execute(`SELECT id, idInmobiliaria FROM propiedades WHERE ${where.join(" AND ")} FOR UPDATE`, parametros)
    if (!filas.length) { await conexion.rollback(); return false }
    const archivosEliminar = await adjuntos.prepararEliminacion(conexion, "propiedad", filas[0])
    await conexion.execute(`DELETE FROM propiedades WHERE ${where.join(" AND ")}`, parametros)
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

async function contarPorEstado(idInmobiliaria) {
  const [filas] = await db.execute(
    `SELECT
       ec.nombre AS estado,
       COUNT(*) AS total
     FROM propiedades p
     INNER JOIN estadosComerciales ec ON ec.id = p.idEstadoComercial
     WHERE p.idInmobiliaria = ?
     GROUP BY ec.nombre`,
    [idInmobiliaria]
  )

  const porEstado = Object.fromEntries(filas.map((fila) => [fila.estado, Number(fila.total)]))
  return {
    total: filas.reduce((suma, fila) => suma + Number(fila.total), 0),
    disponibles: porEstado.Disponible ?? 0,
    reservadas: porEstado.Reservada ?? 0,
    alquiladas: porEstado.Alquilada ?? 0,
    vendidas: porEstado.Vendida ?? 0,
    inactivas: porEstado.Inactiva ?? 0,
  }
}

async function listarDePropietario(idInmobiliaria, idPersona) {
  const [filas] = await db.execute(
    `SELECT
       p.id,
       p.nombre,
       p.ubicacion,
       ec.nombre AS estadoComercial,
       p.precio,
       p.moneda,
       p.idAgente
     FROM propiedades p
     INNER JOIN estadosComerciales ec ON ec.id = p.idEstadoComercial
     INNER JOIN propiedadesPersonas pp
       ON pp.idPropiedad = p.id
       AND pp.idInmobiliaria = p.idInmobiliaria
     INNER JOIN tiposParticipacion tp ON tp.id = pp.idTipoParticipacion
     WHERE p.idInmobiliaria = ?
       AND pp.idPersona = ?
       AND tp.nombre = 'Propietario'
     ORDER BY p.nombre, p.id`,
    [idInmobiliaria, idPersona]
  )
  return filas.map((fila) => ({ ...fila, precio: fila.precio === null ? null : Number(fila.precio) }))
}

module.exports = { catalogos, listar, buscarPorId, crear, actualizar, eliminar, contarPorEstado, listarDePropietario }
