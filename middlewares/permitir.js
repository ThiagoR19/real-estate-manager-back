const roles = require("../config/roles");
const rolesValidos = Object.values(roles);

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
        res.status(403).json({ error: "Sin permiso" })
    }
}
module.exports = permitir;