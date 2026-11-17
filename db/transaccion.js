const db = require("./conexion")

async function enTransaccion(trabajo) {
  const conexion = await db.getConnection()
  try {
    await conexion.beginTransaction()
    const resultado = await trabajo(conexion)
    if (resultado?.error) {
      await conexion.rollback()
    } else {
      await conexion.commit()
    }
    return resultado
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}

module.exports = enTransaccion
