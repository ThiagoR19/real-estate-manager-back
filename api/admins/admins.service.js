const bcrypt = require("bcrypt")
const db = require("../../db/conexion")
const { crearEnlaceActivacion, crearTokenActivacion } = require("../../utils/activacion")
const { ADMIN } = require("../../config/roles")

const SALT_ROUNDS = Number(process.env.SALT_ROUNDS) || 10

async function listar() {
  try {
    const [admins] = db.execute(`
      SELECT
        u.id,
        u.id_inmobiliaria AS idInmobiliaria,
        p.id AS idPersona,
        p.Nombre AS nombre,
        p.Apellido AS apellido,
        p.Correo AS correo,
        p.DNI AS dni,
        p.Teléfono AS telefono,
        p.Dirección AS direccion,
        u.Usuario AS usuario,
        u.Estado AS estadoCuenta
      FROM Usuarios u
      INNER JOIN Personas p ON p.id = u.id_persona
    `)
    return admins
  } catch (error) {
    throw error
  }
}

async function crear(cuerpo = {}) {
  const password = await bcrypt.hash(cuerpo.password, SALT_ROUNDS)
  const activacion = crearTokenActivacion()
  const conexion = await db.getConnection()

  try {
    await conexion.beginTransaction()

    const [persona] = await conexion.execute(
      `INSERT INTO Personas
        (id_inmobiliaria, Nombre, Apellido, Correo, DNI, Teléfono, Dirección)
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
      `INSERT INTO Usuarios
        (id_inmobiliaria, id_persona, Usuario, Password_hash, id_rol, Estado)
       VALUES (?, ?, ?, ?, ?, 'PENDIENTE_ACTIVACION')`,
      [cuerpo.idInmobiliaria, persona.insertId, cuerpo.usuario, password, ADMIN]
    )

    await conexion.execute(
      `INSERT INTO TokensAcceso
        (id_usuario, Token_hash, Proposito, Fecha_expiracion)
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
    const [filas] = await conexion.execute(`SELECT u.id, u.id_persona AS idPersona FROM Usuarios u WHERE u.id = ? AND u.id_rol = ?`, [id, ADMIN])
    if (!filas.length) { await conexion.rollback(); return false }
    const admin = filas[0]
    await conexion.execute(`DELETE FROM Usuarios WHERE id = ?`, [admin.id])
    await conexion.execute(`DELETE FROM Usuarios WHERE id = ?`, [admin.idPersona])
    await conexion.commit()
    return true
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}

module.exports = { listar, crear, eliminar }
