const roles = require("../config/roles");
const rolesValidos = Object.values(roles);
const { verificarToken } = require("../utils/token")

function permitir(...rolesPermitidos) {

    rolesPermitidos.forEach((rol) => {
        if (!rolesValidos.includes(rol)) {
            throw new Error(`permitir(): el rol "${rol}" no existe en config/roles.js`);
        }
    })
    return (req, res, next) => {
        const rol = verificarToken(req.usuario.token).rol

        if (rolesPermitidos.includes(rol)) {
            next();
        }
        else{
            return res.status(403).send("Su rol no tiene acceso a esta funcion")
        }
    };
}
module.exports = permitir;