const db = require("../../db/conexion")
const { rangoDelDia } = require("../../utils/fechas")

const ZONA_HORARIA = "-03:00"
const PROGRAMADA = "Programada"
const REALIZADA = "Realizada"
const CANCELADA = "Cancelada"

const SELECT_VISITA = `
  SELECT
    v.id,
    v.idInmobiliaria,
    v.fecha,
    ev.nombre AS estado,
    v.motivoCancelacion,
    v.fechaCancelacion,
    v.fechaCreacion,
    c.id AS idCliente,
    v.idPersona,
    pc.nombre AS clienteNombre,
    pc.apellido AS clienteApellido,
    pc.telefono AS clienteTelefono,
    pc.correo AS clienteCorreo,
    p.id AS idPropiedad,
    p.nombre AS propiedad,
    p.ubicacion AS propiedadUbicacion,
    a.id AS idAgente,
    pa.nombre AS agenteNombre,
    pa.apellido AS agenteApellido
`

const FROM_VISITA = `
  FROM visitas v
  INNER JOIN estadosVisitas ev
    ON ev.id = v.idEstado
  INNER JOIN personas pc
    ON pc.id = v.idPersona
    AND pc.idInmobiliaria = v.idInmobiliaria
  LEFT JOIN clientes c
    ON c.idPersona = v.idPersona
    AND c.idInmobiliaria = v.idInmobiliaria
  INNER JOIN propiedades p
    ON p.id = v.idPropiedad
    AND p.idInmobiliaria = v.idInmobiliaria
  INNER JOIN agentes a
    ON a.id = v.idAgente
    AND a.idInmobiliaria = v.idInmobiliaria
  INNER JOIN personas pa
    ON pa.id = a.idPersona
    AND pa.idInmobiliaria = a.idInmobiliaria
`

async function listarClientes(idInmobiliaria) {
  const [filas] = await db.execute(
    `SELECT c.id, p.nombre, p.apellido, c.interes
     FROM clientes c INNER JOIN personas p ON p.id = c.idPersona AND p.idInmobiliaria = c.idInmobiliaria
     WHERE c.idInmobiliaria = ? ORDER BY p.apellido, p.nombre`,
    [idInmobiliaria]
  )
  return filas
}

async function crearCliente(idInmobiliaria, cuerpo) {
  const conexion = await db.getConnection()
  try {
    await conexion.beginTransaction()
    const [persona] = await conexion.execute(
      "INSERT INTO personas (idInmobiliaria, nombre, apellido) VALUES (?, ?, ?)",
      [idInmobiliaria, cuerpo.nombre, cuerpo.apellido]
    )
    const [cliente] = await conexion.execute(
      "INSERT INTO clientes (idInmobiliaria, idPersona, interes) VALUES (?, ?, ?)",
      [idInmobiliaria, persona.insertId, cuerpo.interes]
    )
    await conexion.commit()
    return { id: cliente.insertId, nombre: cuerpo.nombre, apellido: cuerpo.apellido, interes: cuerpo.interes }
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally { conexion.release() }
}

const esFechaSola = (valor) => /^\d{4}-\d{2}-\d{2}$/.test(valor)

function inicioDelDia(valor) {
  return esFechaSola(valor) ? new Date(`${valor}T00:00:00${ZONA_HORARIA}`) : new Date(valor)
}

function finDelDia(valor) {
  if (!esFechaSola(valor)) {
    return new Date(valor)
  }
  const inicio = new Date(`${valor}T00:00:00${ZONA_HORARIA}`)
  return new Date(inicio.getTime() + 24 * 60 * 60 * 1000)
}

async function idEstado(nombre) {
  const [filas] = await db.execute(`SELECT ev.id FROM estadosVisitas ev WHERE ev.nombre = ?`, [nombre])
  return filas[0]?.id ?? null
}

async function listar(idInmobiliaria, filtros = {}) {
  const { page = 1, limit = 10 } = filtros
  const condiciones = ["v.idInmobiliaria = ?"]
  const parametros = [idInmobiliaria]

  if (filtros.desde) {
    condiciones.push("v.fecha >= ?")
    parametros.push(inicioDelDia(filtros.desde))
  }
  if (filtros.hasta) {
    condiciones.push(esFechaSola(filtros.hasta) ? "v.fecha < ?" : "v.fecha <= ?")
    parametros.push(finDelDia(filtros.hasta))
  }
  if (filtros.idAgente) {
    condiciones.push("v.idAgente = ?")
    parametros.push(filtros.idAgente)
  }
  if (filtros.idCliente) {
    condiciones.push("c.id = ?")
    parametros.push(filtros.idCliente)
  }
  if (filtros.idPropiedad) {
    condiciones.push("v.idPropiedad = ?")
    parametros.push(filtros.idPropiedad)
  }
  if (filtros.estado) {
    condiciones.push("ev.nombre = ?")
    parametros.push(filtros.estado)
  }

  const donde = `WHERE ${condiciones.join(" AND ")}`
  const offset = (page - 1) * limit

  const [[filas], [conteo]] = await Promise.all([
    db.execute(`${SELECT_VISITA} ${FROM_VISITA} ${donde} ORDER BY v.fecha, v.id LIMIT ? OFFSET ?`, [...parametros, limit, offset]),
    db.execute(`SELECT COUNT(*) AS total ${FROM_VISITA} ${donde}`, parametros),
  ])

  const total = Number(conteo[0].total)
  return {
    items: filas,
    paginacion: { pagina: page, limite: limit, total, paginas: Math.ceil(total / limit) },
  }
}

async function buscarPorId(idInmobiliaria, id) {
  const [filas] = await db.execute(`${SELECT_VISITA} ${FROM_VISITA} WHERE v.idInmobiliaria = ? AND v.id = ?`, [idInmobiliaria, id])
  return filas[0] || null
}

async function agenteDelUsuario(idUsuario, idInmobiliaria) {
  const [filas] = await db.execute(
    `SELECT a.id
     FROM agentes a
     INNER JOIN usuarios u
       ON u.idPersona = a.idPersona
       AND u.idInmobiliaria = a.idInmobiliaria
     WHERE u.id = ?
       AND a.idInmobiliaria = ?`,
    [idUsuario, idInmobiliaria]
  )
  return filas[0]?.id ?? null
}

async function validarRelaciones(idInmobiliaria, { idCliente, idPropiedad, idAgente }) {
  const [[clientes], [propiedades], [agentes]] = await Promise.all([
    db.execute(`SELECT c.idPersona FROM clientes c WHERE c.id = ? AND c.idInmobiliaria = ?`, [idCliente, idInmobiliaria]),
    db.execute(`SELECT p.id FROM propiedades p WHERE p.id = ? AND p.idInmobiliaria = ?`, [idPropiedad, idInmobiliaria]),
    db.execute(`SELECT a.id FROM agentes a WHERE a.id = ? AND a.idInmobiliaria = ?`, [idAgente, idInmobiliaria]),
  ])

  if (!clientes.length) {
    return { error: "NO_ENCONTRADO", mensaje: "El cliente no existe" }
  }
  if (!propiedades.length) {
    return { error: "NO_ENCONTRADO", mensaje: "La propiedad no existe" }
  }
  if (!agentes.length) {
    return { error: "NO_ENCONTRADO", mensaje: "El agente no existe" }
  }
  return { idPersona: clientes[0].idPersona }
}

async function programar(usuario, cuerpo) {
  const idInmobiliaria = usuario.idInmobi

  if (cuerpo.fecha <= new Date()) {
    return { error: "DATOS_INVALIDOS", mensaje: "La visita debe programarse en una fecha futura" }
  }

  const idAgente = cuerpo.idAgente ?? await agenteDelUsuario(usuario.id, idInmobiliaria)
  if (!idAgente) {
    return { error: "DATOS_INVALIDOS", mensaje: "Debe indicar el agente responsable" }
  }

  const relaciones = await validarRelaciones(idInmobiliaria, { ...cuerpo, idAgente })
  if (relaciones.error) {
    return relaciones
  }

  const estado = await idEstado(PROGRAMADA)
  const [resultado] = await db.execute(
    `INSERT INTO visitas (idInmobiliaria, idPersona, idPropiedad, idAgente, idEstado, fecha) VALUES (?, ?, ?, ?, ?, ?)`,
    [idInmobiliaria, relaciones.idPersona, cuerpo.idPropiedad, idAgente, estado, cuerpo.fecha]
  )

  return { visita: await buscarPorId(idInmobiliaria, resultado.insertId) }
}

async function modificar(usuario, id, cuerpo) {
  const idInmobiliaria = usuario.idInmobi
  const actual = await buscarPorId(idInmobiliaria, id)

  if (!actual) {
    return { error: "NO_ENCONTRADO", mensaje: "La visita no existe" }
  }
  if (actual.estado === CANCELADA) {
    return { error: "CONFLICTO", mensaje: "No se puede modificar una visita cancelada" }
  }

  const ahora = new Date()
  const cambiaFecha = cuerpo.fecha.getTime() !== new Date(actual.fecha).getTime()
  if (cuerpo.estado === PROGRAMADA && cambiaFecha && cuerpo.fecha <= ahora) {
    return { error: "DATOS_INVALIDOS", mensaje: "La visita debe programarse en una fecha futura" }
  }
  if (cuerpo.estado === REALIZADA && cuerpo.fecha > ahora) {
    return { error: "DATOS_INVALIDOS", mensaje: "No se puede marcar como realizada una visita futura" }
  }

  const relaciones = await validarRelaciones(idInmobiliaria, cuerpo)
  if (relaciones.error) {
    return relaciones
  }

  const [estado, cancelada] = await Promise.all([idEstado(cuerpo.estado), idEstado(CANCELADA)])
  const [resultado] = await db.execute(
    `UPDATE visitas
     SET idPersona = ?, idPropiedad = ?, idAgente = ?, idEstado = ?, fecha = ?
     WHERE id = ?
       AND idInmobiliaria = ?
       AND idEstado <> ?`,
    [relaciones.idPersona, cuerpo.idPropiedad, cuerpo.idAgente, estado, cuerpo.fecha, id, idInmobiliaria, cancelada]
  )

  if (!resultado.affectedRows) {
    return { error: "CONFLICTO", mensaje: "No se puede modificar una visita cancelada" }
  }
  return { visita: await buscarPorId(idInmobiliaria, id) }
}

async function cancelar(usuario, id, motivo) {
  const idInmobiliaria = usuario.idInmobi
  const [programada, cancelada] = await Promise.all([idEstado(PROGRAMADA), idEstado(CANCELADA)])

  const [resultado] = await db.execute(
    `UPDATE visitas
     SET idEstado = ?, motivoCancelacion = ?, fechaCancelacion = CURRENT_TIMESTAMP
     WHERE id = ?
       AND idInmobiliaria = ?
       AND idEstado = ?`,
    [cancelada, motivo, id, idInmobiliaria, programada]
  )

  if (resultado.affectedRows) {
    return { visita: await buscarPorId(idInmobiliaria, id) }
  }

  const actual = await buscarPorId(idInmobiliaria, id)
  if (!actual) {
    return { error: "NO_ENCONTRADO", mensaje: "La visita no existe" }
  }
  return {
    error: "CONFLICTO",
    mensaje: actual.estado === CANCELADA ? "La visita ya está cancelada" : "Solo se pueden cancelar visitas programadas",
  }
}

async function agendaDelDia(idInmobiliaria, idAgente, dia) {
  const { inicio, fin } = rangoDelDia(dia)
  const [filas] = await db.execute(
    `SELECT
       v.id,
       v.fecha,
       ev.nombre AS estado,
       p.id AS idPropiedad,
       p.nombre AS propiedad,
       p.ubicacion AS propiedadUbicacion,
       (
         SELECT pi.nombre
         FROM propiedadesImagenes pi
         WHERE pi.idPropiedad = p.id
           AND pi.idInmobiliaria = p.idInmobiliaria
         ORDER BY pi.orden, pi.id
         LIMIT 1
       ) AS propiedadImagen,
       c.id AS idCliente,
       pc.nombre AS clienteNombre,
       pc.apellido AS clienteApellido
     ${FROM_VISITA}
     WHERE v.idInmobiliaria = ?
       AND v.idAgente = ?
       AND v.fecha >= ?
       AND v.fecha < ?
       AND ev.nombre <> ?
     ORDER BY v.fecha, v.id`,
    [idInmobiliaria, idAgente, inicio, fin, CANCELADA]
  )
  return filas
}

async function contarAgendadasPorDia(idInmobiliaria, desde, hasta) {
  const [filas] = await db.execute(
    `SELECT
       DATE_FORMAT(CONVERT_TZ(v.fecha, '+00:00', ?), '%Y-%m-%d') AS dia,
       COUNT(*) AS total
     FROM visitas v
     INNER JOIN estadosVisitas ev
       ON ev.id = v.idEstado
     WHERE v.idInmobiliaria = ?
       AND v.fecha >= ?
       AND v.fecha < ?
       AND ev.nombre <> ?
     GROUP BY dia`,
    [ZONA_HORARIA, idInmobiliaria, rangoDelDia(desde).inicio, rangoDelDia(hasta).fin, CANCELADA]
  )
  return new Map(filas.map((fila) => [fila.dia, Number(fila.total)]))
}

module.exports = { listar, buscarPorId, programar, modificar, cancelar, agenteDelUsuario, agendaDelDia, contarAgendadasPorDia }
