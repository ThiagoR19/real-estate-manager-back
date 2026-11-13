const db = require("../../db/conexion")
const ciudadesBuenosAires = require("../../db/ciudadesBuenosAires")
const { SUPERADMIN } = require("../../config/roles")

async function listar(usuario, idInmobiliaria) {
  const tenant = usuario.rol === SUPERADMIN ? idInmobiliaria : usuario.idInmobi
  const [filas] = tenant
    ? await db.execute(
      "SELECT id, idInmobiliaria, nombre FROM areas WHERE idInmobiliaria = ? ORDER BY nombre",
      [tenant]
    )
    : await db.execute("SELECT id, idInmobiliaria, nombre FROM areas ORDER BY nombre, idInmobiliaria")
  return filas.filter((fila) => ciudadesBuenosAires.includes(String(fila.nombre || "").trim()))
}

module.exports = { listar }
