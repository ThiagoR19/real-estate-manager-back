const bcrypt = require("bcrypt")
const db = require("../../db/conexion")
const adjuntos = require("../archivos/archivos.service")
const { crearEnlaceActivacion, crearTokenActivacion } = require("../../utils/activacion")
const { ADMIN } = require("../../config/roles")
const { saltRounds } = require("../../config/env")

const SELECT_ADMIN = ` SELECT u.id, u.idInmobiliaria, p.id AS idPersona, p.nombre, p.apellido, p.correo, p.dni, p.telefono, p.direccion, p.fotoPerfil, u.usuario,
  CASE WHEN u.fechaActivacion IS NULL THEN 'PENDIENTE_ACTIVACION' ELSE 'ACTIVO' END AS estadoCuenta
  FROM usuarios u INNER JOIN personas p ON p.id = u.idPersona AND (p.idInmobiliaria <=> u.idInmobiliaria)`

async function buscarAdmin(id, conexion = db) {
  const [filas] = await conexion.execute(
    `${SELECT_ADMIN} WHERE u.id = ? AND u.idRol = ?`,
    [id, ADMIN]
  )
  return filas[0] || null
}

async function listar(query = {}) {
  const pagina = Number(query.page || 1)
  const limite = Number(query.limit || 20)
  const [admins] = await db.execute(
    `${SELECT_ADMIN} WHERE u.idRol = ? ORDER BY p.apellido, p.nombre, u.id LIMIT ? OFFSET ?`,
    [ADMIN, limite, (pagina - 1) * limite]
  )
  const [conteo] = await db.execute("SELECT COUNT(*) AS total FROM usuarios WHERE idRol = ?", [ADMIN])
  const total = Number(conteo[0].total)
  return { items: admins, paginacion: { pagina, limite, total, paginas: Math.ceil(total / limite) } }
}

async function crear(cuerpo = {}) {
  const password = await bcrypt.hash(cuerpo.password, saltRounds)
  const activacion = crearTokenActivacion()
  const conexion = await db.getConnection()

  try {
    await conexion.beginTransaction()

    const [persona] = await conexion.execute(
      `INSERT INTO personas
        (idInmobiliaria, nombre, apellido, correo, dni, telefono, direccion)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        cuerpo.idInmobiliaria,
        cuerpo.nombre,
        cuerpo.apellido,
        cuerpo.correo,
        cuerpo.dni,
        cuerpo.telefono,
        cuerpo.direccion,
      ]
    )

    const [usuario] = await conexion.execute(
      `INSERT INTO usuarios
        (idInmobiliaria, idPersona, usuario, passwordHash, idRol)
       VALUES (?, ?, ?, ?, ?)`,
      [cuerpo.idInmobiliaria, persona.insertId, cuerpo.usuario, password, ADMIN]
    )

    await conexion.execute(
      `INSERT INTO tokensAcceso
        (idUsuario, tokenHash, proposito, fechaExpiracion)
       VALUES (?, ?, 'ACTIVACION', ?)`,
      [usuario.insertId, activacion.hash, activacion.fechaExpiracion]
    )

    await conexion.commit()
    return {
      ...(await buscarAdmin(usuario.insertId)),
      activacion: {
        codigo: activacion.codigo,
        enlace: crearEnlaceActivacion(activacion.codigo),
        expiraEn: activacion.fechaExpiracion.toISOString(),
      },
    }
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}

async function eliminar(id) {
  const conexion = await db.getConnection()
  try {
    await conexion.beginTransaction()
    const [filas] = await conexion.execute(`SELECT u.id, u.idPersona, u.idInmobiliaria FROM usuarios u WHERE u.id = ? AND u.idRol = ?`, [id, ADMIN])
    if (!filas.length) { await conexion.rollback(); return false }
    const admin = filas[0]
    const archivosEliminar = await adjuntos.prepararEliminacion(conexion, "persona", admin)
    await conexion.execute(`DELETE FROM tokensAcceso WHERE idUsuario = ?`, [admin.id])
    await conexion.execute(`DELETE FROM usuarios WHERE id = ?`, [admin.id])
    await conexion.execute(`DELETE FROM personas WHERE id = ?`, [admin.idPersona])
    await conexion.commit()
    await adjuntos.limpiar(archivosEliminar)
    return true
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}

module.exports = { listar, crear, eliminar, buscarAdmin }
