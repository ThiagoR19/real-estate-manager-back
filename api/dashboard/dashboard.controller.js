const service = require("./dashboard.service")
const { exito, fallo } = require("../../utils/res")
const { ADMIN, AGENTE, PROPIETARIO, INQUILINO } = require("../../config/roles")


const RESUMEN_POR_ROL = {
  [ADMIN]: service.resumenAdministrador,
  [AGENTE]: service.resumenAgente,
  [PROPIETARIO]: service.resumenPropietario,
  [INQUILINO]: service.resumenInquilino,
}

async function obtener(req, res, next) {
  const resumen = RESUMEN_POR_ROL[req.usuario.rol]
  if (!resumen) {
    return fallo(res, "SIN_PERMISO")
  }

  try {
    const datos = await resumen(req.usuario)
    return exito(res, datos)
  }
  catch (error) {
    return next(error)
  }
}

module.exports = { obtener }
