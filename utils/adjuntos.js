const path = require("path")
const archivos = require("./archivos")

function problema(codigo) {
  return Object.assign(new Error(codigo), { codigo })
}

async function limpiar(lista) {
  for (const archivo of lista) {
    try {
      await archivos.eliminar(archivo.destino, archivo.nombre, archivo.privado)
    } catch (error) {
      console.error("No se pudo eliminar el archivo", archivo.nombre, error)
    }
  }
}

async function guardarLote(entradas, destino, tipos = ["imagen"], privado = false) {
  const guardados = []
  try {
    for (const entrada of entradas) {
      const resultado = await archivos(entrada, destino, tipos, { privado })
      if (resultado.codigo !== "EXITO") throw problema(resultado.codigo)
      const nombreOriginal = path.basename(String(entrada.name || "documento.pdf").replace(/\\/g, "/")).slice(0, 255) || resultado.nombre
      guardados.push({ ...resultado, destino, privado, nombreOriginal })
    }
    return guardados
  } catch (error) {
    await limpiar(guardados)
    throw error
  }
}

module.exports = { problema, limpiar, guardarLote }
