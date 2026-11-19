const { fallo } = require("../utils/res")

function limitarIntentos({ maximo, ventanaMs, clave = (req) => req.ip }) {
  const intentos = new Map()

  setInterval(() => {
    const ahora = Date.now()
    for (const [id, registro] of intentos) {
      if (registro.reinicio <= ahora) intentos.delete(id)
    }
  }, ventanaMs).unref()

  return (req, res, next) => {
    const id = clave(req)
    const ahora = Date.now()
    let registro = intentos.get(id)
    if (!registro || registro.reinicio <= ahora) {
      registro = { fallidos: 0, reinicio: ahora + ventanaMs }
      intentos.set(id, registro)
    }

    if (registro.fallidos >= maximo) {
      res.set("Retry-After", String(Math.ceil((registro.reinicio - ahora) / 1000)))
      return fallo(res, "DEMASIADOS_INTENTOS")
    }

    res.on("finish", () => {
      if (res.statusCode >= 400 && res.statusCode < 500 && res.statusCode !== 429) registro.fallidos++
    })
    next()
  }
}

const QUINCE_MINUTOS = 15 * 60 * 1000
const normalizar = (valor) => String(valor ?? "").trim().toLowerCase()

const limitarLogin = [
  limitarIntentos({ maximo: 20, ventanaMs: QUINCE_MINUTOS }),
  limitarIntentos({ maximo: 5, ventanaMs: QUINCE_MINUTOS, clave: (req) => `${req.ip}:${normalizar(req.body?.usuario)}` }),
]

const limitarVerificacion = [
  limitarIntentos({ maximo: 20, ventanaMs: QUINCE_MINUTOS }),
  limitarIntentos({ maximo: 5, ventanaMs: QUINCE_MINUTOS, clave: (req) => `${req.ip}:${req.params.codigo}` }),
]

module.exports = { limitarIntentos, limitarLogin, limitarVerificacion }
