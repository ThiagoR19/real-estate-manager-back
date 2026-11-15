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

module.exports = { consultar, listarPropiedades }
