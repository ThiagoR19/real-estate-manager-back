const { verificarToken } = require("../utils/token")
const { fallo } = require("../utils/res")

function autenticar(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith("Bearer ")) {
    return fallo(res, "TOKEN_FALTANTE")
  }

  const token = header.split(" ")[1]
  const datos = verificarToken(token)

  if (!datos || datos.tipo !== "Sesion") {
    return fallo(res, "TOKEN_INVALIDO")
  }

  req.usuario = datos
  next()
}

module.exports = autenticar