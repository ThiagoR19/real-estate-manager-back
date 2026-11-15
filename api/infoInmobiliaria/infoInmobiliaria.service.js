const db = require("../../db/conexion")
const { fechaLocal } = require("../../utils/fechas")

const ESTADOS_ACTIVOS = ["Disponible", "Reservada", "Alquilada"]

const marcadores = (lista) => lista.map(() => "?").join(", ")

function aniosDesde(dia, hoy) {
  const anios = Number(hoy.slice(0, 4)) - Number(dia.slice(0, 4))
  return hoy.slice(5) < dia.slice(5) ? anios - 1 : anios
}

async function consultar(id) {
  const [filas] = await db.execute(
    `SELECT
       i.id,
       i.imagenLogo,
       i.imagenBanner,
       i.imagenPrincipal,
       i.fechaCreacion,
       COALESCE(SUM(ec.nombre = 'Vendida'), 0) AS vendidas,
       COALESCE(SUM(ec.nombre IN (${marcadores(ESTADOS_ACTIVOS)})), 0) AS activas
     FROM inmobiliaria i
     LEFT JOIN propiedades p
       ON p.idInmobiliaria = i.id
     LEFT JOIN estadosComerciales ec
       ON ec.id = p.idEstadoComercial
     WHERE i.id = ?
     GROUP BY i.id`,
    [...ESTADOS_ACTIVOS, id]
  )
  const fila = filas[0]
  if (!fila) {
    return null
  }

  return {
    id: fila.id,
    aniosExperiencia: aniosDesde(fechaLocal(fila.fechaCreacion), fechaLocal()),
    propiedadesVendidas: Number(fila.vendidas),
    propiedadesActivas: Number(fila.activas),
    imagenLogo: fila.imagenLogo,
    urlLogo: fila.imagenLogo ? `/uploads/logos/${fila.imagenLogo}` : null,
  }
}

module.exports = { consultar }
