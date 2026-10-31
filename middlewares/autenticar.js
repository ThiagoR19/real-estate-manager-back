const { verificarToken } = require("../utils/token")

function autenticar(req, res, next) {
    const header = req.headers.authorization
    if (!header || !header.startsWith("Bearer ")) {
        return res.status(401).json({ error: "TOKEN_FALTANTE" })
    }

    const token = header.split(" ")[1]
    const datos = verificarToken(token)

    if (!datos) {
        return res.status(401).json({ error: "TOKEN_INVALIDO" })
    }

    req.usuario = datos
    next()
}

module.exports = autenticar