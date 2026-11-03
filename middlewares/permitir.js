const roles = require("../config/roles");
const rolesValidos = Object.values(roles);
const { fallo } = require("../utils/res")

function permitir(...rolesPermitidos) {

  rolesPermitidos.forEach((rol) => {
    if (!rolesValidos.includes(rol)) {
      throw new Error(`permitir(): el rol "${rol}" no existe en config/roles.js`);
    }
  })
  return (req, res, next) => {
    if (rolesPermitidos.includes(req.usuario.rol)) {
      return next()
    }
    return fallo(res, "SIN_PERMISO")
  }
}
module.exports = permitir;