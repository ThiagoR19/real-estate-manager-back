const { PROPIETARIO, INQUILINO } = require("../config/roles")

const CONDICION_DESACTIVADA = `(
  (u.idRol = ? AND EXISTS (
    SELECT 1 FROM inquilinos ci
    WHERE ci.idPersona = u.idPersona AND ci.idInmobiliaria = u.idInmobiliaria AND ci.activo = FALSE
  ))
  OR (u.idRol = ? AND EXISTS (
    SELECT 1 FROM propietarios cp
    WHERE cp.idPersona = u.idPersona AND cp.idInmobiliaria = u.idInmobiliaria AND cp.activo = FALSE
  ))
)`

const PARAMETROS_DESACTIVADA = [INQUILINO, PROPIETARIO]

module.exports = { CONDICION_DESACTIVADA, PARAMETROS_DESACTIVADA }
