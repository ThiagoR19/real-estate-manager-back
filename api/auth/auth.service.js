const bcrypt = require("bcrypt")
const db = require("../../db/conexion")
const AppError = require("../../utils/app-error")
const { crearTokenS } = require("../../utils/token")
const { hashearToken } = require("../../utils/activacion")
const { validarCodigo, validarActivacion, validarLogin } = require("./auth.validation")

const SALT_ROUNDS = Number(process.env.SALT_ROUNDS) || 10

async function activarCuenta(codigo, passwordHash) {
  const conexion = await db.getConnection()

  try {
    await conexion.beginTransaction()

    const [filas] = await conexion.execute(
      `SELECT
         ta.id AS idToken,
         u.id AS idUsuario,
         u.Usuario AS usuario,
         u.id_rol AS idRol,
         p.Nombre AS nombre,
         p.Apellido AS apellido,
         p.id_inmobiliaria AS idInmobi
       FROM TokensAcceso ta
       INNER JOIN Usuarios u ON u.id = ta.id_usuario
       INNER JOIN Personas p ON p.id = u.id_persona
       WHERE ta.Token_hash = ?
         AND ta.Proposito = 'ACTIVACION'
         AND ta.Fecha_uso IS NULL
         AND ta.Fecha_expiracion > CURRENT_TIMESTAMP
         AND u.Estado = 'PENDIENTE_ACTIVACION'
       FOR UPDATE`,
      [hashearToken(codigo)]
    )

    if (filas.length === 0) {
      await conexion.rollback()
      return null
    }

    const cuenta = filas[0]

    await conexion.execute(
      `UPDATE Usuarios
       SET Password_hash = ?,
           Estado = 'ACTIVO',
           Fecha_activacion = COALESCE(Fecha_activacion, CURRENT_TIMESTAMP),
           Fecha_baja = NULL,
           Motivo_baja = NULL
       WHERE id = ?`,
      [passwordHash, cuenta.idUsuario]
    )

    await conexion.execute(
      `UPDATE TokensAcceso
       SET Fecha_uso = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [cuenta.idToken]
    )

    await conexion.commit()
    return cuenta
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}

async function buscarCuentaPorUsuario(usuario) {
  const [filas] = await db.execute(
    `SELECT
       u.id AS idUsuario,
       u.Usuario AS usuario,
       u.Password_hash AS passwordHash,
       u.Estado AS estado,
       u.id_rol AS idRol,
       p.Nombre AS nombre,
       p.Apellido AS apellido,
       p.id_inmobiliaria AS idInmobi
     FROM Usuarios u
     INNER JOIN Personas p ON p.id = u.id_persona
     WHERE u.Usuario = ?
     LIMIT 1`,
    [usuario]
  )

  return filas[0] || null
}

async function registrarAcceso(idUsuario) {
  await db.execute(
    "UPDATE Usuarios SET Ultimo_acceso = CURRENT_TIMESTAMP WHERE id = ?",
    [idUsuario]
  )
}

async function activar(codigo, cuerpo) {
  const codigoValidado = validarCodigo(codigo)
  const datos = validarActivacion(cuerpo)
  const passwordHash = await bcrypt.hash(datos.password, SALT_ROUNDS)
  const cuenta = await activarCuenta(codigoValidado, passwordHash)

  if (!cuenta) {
    throw new AppError("INVITACION_INVALIDA", "La invitación no existe, expiró o ya fue utilizada")
  }

  const token = crearTokenS(
    cuenta.nombre,
    cuenta.apellido,
    cuenta.idRol,
    cuenta.idUsuario,
    cuenta.idInmobi
  )

  return {
    token,
    usuario: {
      id: cuenta.idUsuario,
      usuario: cuenta.usuario,
      nombre: cuenta.nombre,
      apellido: cuenta.apellido,
      rol: cuenta.idRol,
      idInmobi: cuenta.idInmobi,
      estado: "ACTIVO",
    },
  }
}

async function login(cuerpo) {
  const datos = validarLogin(cuerpo)
  const cuenta = await buscarCuentaPorUsuario(datos.usuario)
  const passwordValida = cuenta && cuenta.passwordHash
    ? await bcrypt.compare(datos.password, cuenta.passwordHash)
    : false

  if (!passwordValida) {
    throw new AppError("CREDENCIALES_INVALIDAS")
  }

  if (cuenta.estado === "PENDIENTE_ACTIVACION") {
    throw new AppError("CUENTA_NO_ACTIVADA")
  }

  if (cuenta.estado !== "ACTIVO") {
    throw new AppError("CUENTA_DESACTIVADA")
  }

  await registrarAcceso(cuenta.idUsuario)

  return {
    token: crearTokenS(
      cuenta.nombre,
      cuenta.apellido,
      cuenta.idRol,
      cuenta.idUsuario,
      cuenta.idInmobi
    ),
    usuario: {
      id: cuenta.idUsuario,
      usuario: cuenta.usuario,
      nombre: cuenta.nombre,
      apellido: cuenta.apellido,
      rol: cuenta.idRol,
      idInmobi: cuenta.idInmobi,
      estado: cuenta.estado,
    },
  }
}

module.exports = { activar, login }
