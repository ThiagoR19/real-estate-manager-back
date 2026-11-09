const { randomUUID } = require("crypto")
const path = require("path")
const fs = require("fs/promises")
const sharp = require("sharp")

const FORMATOS_IMAGEN = ["jpeg", "png", "webp"]

const esPdf = (buffer) => buffer.subarray(0, 5).toString("latin1") === "%PDF-"

async function procesarImagen(buffer) {
  try {
    const imagen = sharp(buffer, { limitInputPixels: 40_000_000 })
    const { format } = await imagen.metadata()
    if (!FORMATOS_IMAGEN.includes(format)) {
      return null
    }

    return await imagen.rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer()
  } catch {
    return null
  }
}

async function archivos(archivo, destino, tipos = ["imagen"]) {
  try {
    if (!archivo) {
      return { codigo: "SIN_ARCHIVO" }
    }
    if (archivo.truncated) {
      return { codigo: "ARCHIVO_MUY_GRANDE" }
    }

    let contenido = null, extension, mimeType

    if (tipos.includes("pdf") && esPdf(archivo.data)) {
      contenido = archivo.data
      extension = ".pdf"
      mimeType = "application/pdf"
    }
    else if (tipos.includes("imagen")) {
      contenido = await procesarImagen(archivo.data)
      extension = ".webp"
      mimeType = "image/webp"
    }
    if (!contenido) return { codigo: "NO_FORMATO" }

    const nombre = `${randomUUID()}${extension}`
    const carpeta = path.join(__dirname, "../uploads/", destino)
    await fs.mkdir(carpeta, { recursive: true })
    await fs.writeFile(path.join(carpeta, nombre), contenido)

    return { codigo: "EXITO", nombre, mimeType, tamanioBytes: contenido.length }
  } catch (err) {
    return { codigo: "NO_GUARDADO", error: err }
  }
}

module.exports = archivos