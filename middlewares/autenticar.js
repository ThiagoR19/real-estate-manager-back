const crypto = require("crypto")
const db = require("../db/conexion")
const { verificarToken } = require("../utils/token")
const { fallo } = require("../utils/res")

async function autenticar(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith("Bearer ")) {
    return fallo(res, "TOKEN_FALTANTE")
  }

  const token = header.split(" ")[1]
  const datos = verificarToken(token)

  if (!datos || datos.tipo !== "Sesion") {
    return fallo(res, "TOKEN_INVALIDO")
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex")
  const [revocaciones] = await db.execute(
    "SELECT 1 FROM sesionesRevocadas WHERE tokenHash = ? AND fechaExpiracion > CURRENT_TIMESTAMP LIMIT 1",
    [tokenHash]
  )
  if (revocaciones.length) return fallo(res, "TOKEN_INVALIDO")

  req.token = token
  req.usuario = datos
  next()
}

module.exports = autenticar
