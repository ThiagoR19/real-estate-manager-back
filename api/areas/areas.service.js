const db = require("../../db/conexion")
const { SUPERADMIN } = require("../../config/roles")

async function listar(usuario, idInmobiliaria) {
  const tenant = usuario.rol === SUPERADMIN ? idInmobiliaria : usuario.idInmobi
  const [filas] = tenant
    ? await db.execute(
      `SELECT a.id, a.idInmobiliaria, c.nombre
       FROM areas a
       INNER JOIN ciudades c ON c.id = a.idCiudad
       WHERE a.idInmobiliaria = ?
       ORDER BY c.nombre`,
      [tenant]
    )
    : await db.execute(`SELECT a.id, a.idInmobiliaria, c.nombre
                        FROM areas a
                        INNER JOIN ciudades c ON c.id = a.idCiudad
                        ORDER BY c.nombre, a.idInmobiliaria`)
  return filas
}

module.exports = { listar }
