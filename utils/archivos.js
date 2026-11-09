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

function rutaArchivo(destino, nombre, privado = false) {
  const raiz = path.resolve(__dirname, privado ? "../storage" : "../uploads")
  const carpeta = path.resolve(raiz, destino)
  if (!carpeta.startsWith(`${raiz}${path.sep}`) || !nombre || [".", ".."].includes(nombre) || path.basename(nombre) !== nombre || /[\\/:]/.test(nombre)) {
    throw new Error("Ruta de archivo inválida")
  }
  return path.join(carpeta, nombre)
}

async function eliminar(destino, nombre, privado = false) {
  if (!nombre) return
  await fs.rm(rutaArchivo(destino, nombre, privado), { force: true })
}

async function archivos(archivo, destino, tipos = ["imagen"], { privado = false } = {}) {
  let ruta
  try {
    if (!archivo) {
      return { codigo: "SIN_ARCHIVO" }
    }
    if (archivo.truncated) {
      return { codigo: "ARCHIVO_MUY_GRANDE" }
    }
    if (Array.isArray(archivo) || !Buffer.isBuffer(archivo.data) || !archivo.data.length) {
      return { codigo: "NO_FORMATO" }
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
    ruta = rutaArchivo(destino, nombre, privado)
    await fs.mkdir(path.dirname(ruta), { recursive: true })
    await fs.writeFile(ruta, contenido)

    return { codigo: "EXITO", nombre, mimeType, tamanioBytes: contenido.length }
  } catch (err) {
    if (ruta) {
      try { await fs.rm(ruta, { force: true }) }
      catch (error) { console.error("No se pudo limpiar el archivo incompleto", error) }
    }
    return { codigo: "NO_GUARDADO", error: err }
  }
}

module.exports = archivos
module.exports.eliminar = eliminar
module.exports.rutaArchivo = rutaArchivo
