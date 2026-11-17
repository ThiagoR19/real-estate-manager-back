const fileUpload = require("express-fileupload")
const { fallo } = require("../utils/res")

function recibirArchivos(campo, { maximo = 1, megabytes = 2, permitirTitulo = false } = {}) {
  return [
    fileUpload({ limits: { fileSize: megabytes * 1024 * 1024, files: maximo + 1, fields: permitirTitulo ? 2 : 1 }, createParentPath: true }),
    (req, res, next) => {
      const campos = Object.keys(req.body || {})
      if (campos.some((nombre) => !permitirTitulo || nombre !== "titulo") ||
          Object.keys(req.files || {}).some((nombre) => nombre !== campo)) {
        return fallo(res, "DATOS_INVALIDOS", { mensaje: `Solo se admite el campo de archivo ${campo}` })
      }
      const valor = req.files?.[campo]
      const archivos = valor ? (Array.isArray(valor) ? valor : [valor]) : []
      if (permitirTitulo && req.body?.titulo &&
          (typeof req.body.titulo !== "string" || req.body.titulo.trim().length > 255 || archivos.length !== 1)) {
        return fallo(res, "DATOS_INVALIDOS", { mensaje: "El título requiere un único archivo y hasta 255 caracteres" })
      }
      if (!archivos.length) return fallo(res, "SIN_ARCHIVO")
      if (archivos.length > maximo) {
        return fallo(res, "DATOS_INVALIDOS", { mensaje: `Se admiten hasta ${maximo} archivos por petición` })
      }
      if (archivos.some((archivo) => archivo.truncated)) return fallo(res, "ARCHIVO_MUY_GRANDE")
      req.archivos = archivos
      next()
    },
  ]
}

module.exports = recibirArchivos
