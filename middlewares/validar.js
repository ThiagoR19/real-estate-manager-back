const { fallo } = require("../utils/res")

function detallesDeZod(error) {
  return error.issues.map((issue) => ({
    campo: issue.path.length ? issue.path.join(".") : "entrada",
    mensaje: issue.message,
  }))
}

function validar(schema, fuente = "body") {
  return (req, res, next) => {
    const resultado = schema.safeParse(req[fuente])

    if (!resultado.success) {
      return fallo(res, "DATOS_INVALIDOS", {
        detalles: detallesDeZod(resultado.error),
      })
    }

    req.validado = req.validado || {}
    req.validado[fuente] = resultado.data
    return next()
  }
}

module.exports = validar
