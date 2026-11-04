const { verificarToken } = require("../utils/token")
const { fallo } = require("../utils/res")

function autenticarRegistro(req, res, next) {
    const header = req.headers.authorization
    if (!header || !header.startsWith("Bearer ")) {
        return fallo(res, "TOKEN_FALTANTE")
    }

    const token = header.split(" ")[1]
    const datos = verificarToken(token)

    if (!datos || datos.tipo !== "Registro") {
        return fallo(res, "TOKEN_INVALIDO")
    }

    req.registro = datos
    next()
}

module.exports = autenticarRegistro
