const test = require("node:test")
const assert = require("node:assert/strict")

for (const variable of ["DB_HOST", "DB_USER", "DB_NAME", "TOKEN_SECRET", "FRONT_URL", "PORT"]) {
  process.env[variable] ||= "test"
}

const db = require("../db/conexion")
const adjuntos = require("../utils/adjuntos")
const originalLimpiar = adjuntos.limpiar
const originalConexion = db.getConnection
const service = require("../api/inmobiliarias/inmobiliarias.service")

test("la baja de inmobiliaria limpia sus archivos solo después del commit", async () => {
  const eventos = []
  let archivos
  adjuntos.limpiar = async (lista) => { archivos = lista; eventos.push("limpiar") }
  // El servicio captura limpiar al cargar el módulo.
  delete require.cache[require.resolve("../api/inmobiliarias/inmobiliarias.service")]
  const servicio = require("../api/inmobiliarias/inmobiliarias.service")
  db.getConnection = async () => ({
    async beginTransaction() { eventos.push("inicio") },
    async commit() { eventos.push("commit") },
    async rollback() { eventos.push("rollback") },
    release() {},
    async execute(sql) {
      if (sql.includes("SELECT i.id, i.imagenLogo")) return [[{ id: 1, imagenLogo: "logo.webp" }]]
      if (sql.includes("SELECT rutaArchivo FROM mensajesAdjuntos")) return [[{ rutaArchivo: "chats/chat.webp" }]]
      if (sql.includes("FROM personas WHERE idInmobiliaria")) return [[{ nombre: "perfil.webp" }]]
      if (sql.includes("FROM propiedadesImagenes WHERE idInmobiliaria")) return [[{ nombre: "propiedad.webp" }]]
      if (sql.includes("FROM reportesImagenes WHERE idInmobiliaria")) return [[{ nombre: "reporte.webp" }]]
      if (sql.includes("FROM versionesDocumentos WHERE idInmobiliaria")) return [[{ nombre: "documento.pdf" }]]
      if (sql.includes("SELECT id FROM usuarios")) return [[]]
      return [{ affectedRows: 1 }]
    },
  })
  try {
    assert.equal(await servicio.eliminar(1), true)
    assert.deepEqual(eventos, ["inicio", "commit", "limpiar"])
    assert.deepEqual(archivos.map(({ destino, nombre }) => `${destino}/${nombre}`).sort(), [
      "chats/chat.webp", "documentos/documento.pdf", "logos/logo.webp",
      "perfiles/perfil.webp", "propiedades/propiedad.webp", "reportes/reporte.webp",
    ])
  } finally {
    db.getConnection = originalConexion
    adjuntos.limpiar = originalLimpiar
    require.cache[require.resolve("../api/inmobiliarias/inmobiliarias.service")].exports = service
  }
})
