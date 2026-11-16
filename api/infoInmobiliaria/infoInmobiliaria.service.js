const db = require("../../db/conexion")
const inmobiliarias = require("../inmobiliarias/inmobiliarias.service")
const propiedades = require("../propiedades/propiedades.service")
const { fechaLocal } = require("../../utils/fechas")

function aniosDesde(dia, hoy) {
  const anios = Number(hoy.slice(0, 4)) - Number(dia.slice(0, 4))
  return hoy.slice(5) < dia.slice(5) ? anios - 1 : anios
}

async function consultar(id) {
  const inmobiliaria = await inmobiliarias.buscarPorId(id)
  if (!inmobiliaria) {
    return null
  }

  const estados = await propiedades.contarPorEstado(id)

  return {
    id: inmobiliaria.id,
    nombre: inmobiliaria.nombre,
    aniosExperiencia: aniosDesde(fechaLocal(inmobiliaria.fechaCreacion), fechaLocal()),
    propiedadesVendidas: estados.vendidas,
    propiedadesActivas: estados.disponibles + estados.reservadas + estados.alquiladas,
    imagenLogo: inmobiliaria.imagenLogo,
    urlLogo: inmobiliaria.urlLogo,
    imagenBanner: inmobiliaria.imagenBanner,
    urlBanner: inmobiliaria.urlBanner,
    imagenPrincipal: inmobiliaria.imagenPrincipal,
    urlPrincipal: inmobiliaria.urlPrincipal,
  }
}

function listarPropiedades(id, limite) {
  return propiedades.listarPublicadas(id, limite)
}

const ESTADOS_PUBLICOS = ["Disponible", "Reservada", "Alquilada"]

const ORDENES = {
  recientes: "p.fechaCreacion DESC, p.id DESC",
  menorPrecio: "p.precio IS NULL, p.precio ASC, p.id DESC",
  mayorPrecio: "p.precio DESC, p.id DESC",
}

const DESDE_PUBLICADAS = `
  FROM propiedades p
  INNER JOIN estadosComerciales ec ON ec.id = p.idEstadoComercial
  INNER JOIN tiposPropiedades tp ON tp.id = p.idTipo
`

function soloPublicadas(idInmobiliaria) {
  return {
    condiciones: [
      "p.idInmobiliaria = ?",
      "p.publicada = TRUE",
      `ec.nombre IN (${ESTADOS_PUBLICOS.map(() => "?").join(", ")})`,
    ],
    valores: [idInmobiliaria, ...ESTADOS_PUBLICOS],
  }
}

function filtrosDelCatalogo(idInmobiliaria, filtros) {
  const { condiciones, valores } = soloPublicadas(idInmobiliaria)
  const tipos = (filtros.tipo ?? "").split(",").map((tipo) => tipo.trim()).filter(Boolean)

  if (filtros.operacion) {
    condiciones.push("p.operacion = ?")
    valores.push(filtros.operacion)
  }
  if (filtros.ubicacion) {
    condiciones.push("p.ubicacion LIKE ?")
    valores.push(`%${filtros.ubicacion.replace(/[\\%_]/g, "\\$&")}%`)
  }
  if (tipos.length) {
    condiciones.push(`tp.nombre IN (${tipos.map(() => "?").join(", ")})`)
    valores.push(...tipos)
  }
  if (filtros.moneda) {
    condiciones.push("p.moneda = ?")
    valores.push(filtros.moneda)
  }
  if (filtros.precioMin !== undefined) {
    condiciones.push("p.precio >= ?")
    valores.push(filtros.precioMin)
  }
  if (filtros.precioMax !== undefined) {
    condiciones.push("p.precio <= ?")
    valores.push(filtros.precioMax)
  }
  if (filtros.habitaciones === "4+") {
    condiciones.push("p.habitaciones >= 4")
  } else if (filtros.habitaciones) {
    condiciones.push("p.habitaciones = ?")
    valores.push(Number(filtros.habitaciones))
  }

  return { where: condiciones.join(" AND "), valores }
}

function numeroONulo(valor) {
  return valor === null ? null : Number(valor)
}

async function catalogo(idInmobiliaria, filtros) {
  const limite = filtros.limite ?? 12
  const orden = ORDENES[filtros.orden ?? "recientes"]
  const { where, valores } = filtrosDelCatalogo(idInmobiliaria, filtros)

  const [[conteo]] = await db.execute(`SELECT COUNT(*) AS total ${DESDE_PUBLICADAS} WHERE ${where}`, valores)
  const total = Number(conteo.total)
  const paginas = Math.max(1, Math.ceil(total / limite))
  const pagina = Math.min(filtros.pagina ?? 1, paginas)

  const [[filas], [tipos]] = await Promise.all([
    db.execute(
      `SELECT
         p.id,
         p.nombre,
         p.ubicacion,
         p.precio,
         p.moneda,
         p.operacion,
         p.tamanio,
         p.banios,
         p.habitaciones,
         tp.nombre AS tipo,
         (
           SELECT pi.nombre
           FROM propiedadesImagenes pi
           WHERE pi.idPropiedad = p.id
             AND pi.idInmobiliaria = p.idInmobiliaria
           ORDER BY pi.orden, pi.id
           LIMIT 1
         ) AS imagen
       ${DESDE_PUBLICADAS}
       WHERE ${where}
       ORDER BY ${orden}
       LIMIT ? OFFSET ?`,
      [...valores, limite, (pagina - 1) * limite]
    ),
    db.execute("SELECT nombre FROM tiposPropiedades ORDER BY nombre"),
  ])

  return {
    items: filas.map((fila) => ({
      ...fila,
      precio: numeroONulo(fila.precio),
      tamanio: numeroONulo(fila.tamanio),
      urlImagen: fila.imagen ? `/uploads/propiedades/${fila.imagen}` : null,
    })),
    paginacion: { pagina, limite, total, paginas },
    tipos: tipos.map((tipo) => tipo.nombre),
  }
}

async function propiedad(idInmobiliaria, idPropiedad) {
  const { condiciones, valores } = soloPublicadas(idInmobiliaria)

  const [filas] = await db.execute(
    `SELECT
       p.id,
       p.nombre,
       p.descripcion,
       p.ubicacion,
       p.precio,
       p.moneda,
       p.operacion,
       p.tamanio,
       p.antiguedad,
       p.banios,
       p.habitaciones,
       tp.nombre AS tipo,
       CONCAT_WS(' ', pe.nombre, pe.apellido) AS agente,
       pe.telefono AS telefonoAgente
     ${DESDE_PUBLICADAS}
     LEFT JOIN agentes a ON a.idInmobiliaria = p.idInmobiliaria AND a.id = p.idAgente
     LEFT JOIN personas pe ON pe.idInmobiliaria = a.idInmobiliaria AND pe.id = a.idPersona
     WHERE ${condiciones.join(" AND ")} AND p.id = ?`,
    [...valores, idPropiedad]
  )

  if (!filas.length) {
    return null
  }

  const [imagenes] = await db.execute(
    `SELECT nombre
     FROM propiedadesImagenes
     WHERE idPropiedad = ? AND idInmobiliaria = ?
     ORDER BY orden, id`,
    [idPropiedad, idInmobiliaria]
  )

  const fila = filas[0]
  return {
    ...fila,
    precio: numeroONulo(fila.precio),
    tamanio: numeroONulo(fila.tamanio),
    agente: fila.agente || null,
    imagenes: imagenes.map((imagen) => `/uploads/propiedades/${imagen.nombre}`),
  }
}

module.exports = { consultar, listarPropiedades, catalogo, propiedad }
