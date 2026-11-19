const db = require("../../db/conexion")
const documentos = require("../documentos/documentos.service")
const { fechaLocal } = require("../../utils/fechas")
const { SUPERADMIN, ADMIN, AGENTE, PROPIETARIO, INQUILINO } = require("../../config/roles")
const { guardar } = require("../notificaciones/notificaciones.service")
const { reglasDeContrato } = require("./contratos.schema")

const ESTADOS_SIN_VIGENCIA = ["Borrador", "Anulado"]
const ESTADOS_BLOQUEADOS = ["Rescindido", "Anulado"]
const ROLES_PARTICIPANTES = [PROPIETARIO, INQUILINO]
const ROLES_PERSONAL = [SUPERADMIN, ADMIN, AGENTE]

const REQUISITO_DE_ROL = {
  Propietario: { cumple: (persona) => persona.esPropietario, mensaje: "debe estar registrado como propietario" },
  Vendedor: { cumple: (persona) => persona.esPropietario, mensaje: "debe estar registrado como propietario" },
  Inquilino: { cumple: (persona) => persona.esInquilino, mensaje: "debe estar registrado como inquilino" },
  Comprador: { cumple: (persona) => !persona.esPersonal, mensaje: "no puede ser personal de la inmobiliaria" },
  Garante: { cumple: (persona) => !persona.esPersonal, mensaje: "no puede ser personal de la inmobiliaria" },
}

function participantesConRolInvalido(participantes, personas) {
  const porId = new Map(personas.map((persona) => [persona.id, {
    esPropietario: Boolean(persona.esPropietario),
    esInquilino: Boolean(persona.esInquilino),
    esPersonal: Boolean(persona.esPersonal),
  }]))
  return participantes
    .filter((participante) => !REQUISITO_DE_ROL[participante.rol].cumple(porId.get(participante.idPersona)))
    .map((participante) => ({
      campo: "participantes",
      problema: `La persona #${participante.idPersona} figura como ${participante.rol.toLowerCase()} y ${REQUISITO_DE_ROL[participante.rol].mensaje}`,
    }))
}
const FIN_EFECTIVO = "LEAST(COALESCE(c.fechaFin, c.fechaRescision), COALESCE(c.fechaRescision, c.fechaFin))"

const CAMPOS_CONTRATO = [
  "fechaFirma", "fechaInicio", "fechaFin", "montoAcordado", "moneda", "periodicidadPago",
  "mesesDeAviso", "mesesAumento", "tipoAumento", "valorAumentoFijo", "condiciones",
]

const marcadores = (lista) => lista.map(() => "?").join(", ")
const comoFecha = (valor) => (valor ? valor.toISOString().slice(0, 10) : null)
const comoNumero = (valor) => (valor === null || valor === undefined ? null : Number(valor))

const SELECT_CONTRATO = `
  SELECT
    c.id,
    c.idInmobiliaria,
    tc.nombre AS tipo,
    ec.nombre AS estado,
    c.idPropiedad,
    p.nombre AS propiedad,
    p.ubicacion AS propiedadUbicacion,
    c.idContratoAnterior,
    (
      SELECT r.id
      FROM contratos r
      WHERE r.idContratoAnterior = c.id
        AND r.idInmobiliaria = c.idInmobiliaria
      ORDER BY r.id
      LIMIT 1
    ) AS idRenovacion,
    c.fechaFirma,
    c.fechaInicio,
    c.fechaFin,
    c.fechaRescision,
    c.motivoRescision,
    c.fechaAnulacion,
    c.motivoAnulacion,
    c.montoAcordado,
    c.moneda,
    c.periodicidadPago,
    c.mesesDeAviso,
    c.mesesAumento,
    c.tipoAumento,
    c.valorAumentoFijo,
    c.condiciones
  FROM contratos c
  INNER JOIN tiposContratos tc
    ON tc.id = c.idTipoContrato
  INNER JOIN estadosContratos ec
    ON ec.id = c.idEstadoContrato
  INNER JOIN propiedades p
    ON p.id = c.idPropiedad
    AND p.idInmobiliaria = c.idInmobiliaria
`

const normalizar = (fila) => ({
  ...fila,
  fechaFirma: comoFecha(fila.fechaFirma),
  fechaInicio: comoFecha(fila.fechaInicio),
  fechaFin: comoFecha(fila.fechaFin),
  fechaRescision: comoFecha(fila.fechaRescision),
  montoAcordado: comoNumero(fila.montoAcordado),
  valorAumentoFijo: comoNumero(fila.valorAumentoFijo),
})

async function contarAlquileresVigentes(idInmobiliaria, dias) {
  if (!dias.length) {
    return []
  }

  const [filas] = await db.execute(
    `SELECT
       c.fechaInicio,
       ${FIN_EFECTIVO} AS fechaFin,
       c.fechaAnulacion
     FROM contratos c
     INNER JOIN tiposContratos tc
       ON tc.id = c.idTipoContrato
     INNER JOIN estadosContratos ec
       ON ec.id = c.idEstadoContrato
     WHERE c.idInmobiliaria = ?
       AND tc.nombre = 'Alquiler'
       AND ec.nombre NOT IN (${marcadores(ESTADOS_SIN_VIGENCIA)})
       AND c.fechaInicio IS NOT NULL`,
    [idInmobiliaria, ...ESTADOS_SIN_VIGENCIA]
  )

  const contratos = filas.map((fila) => ({
    inicio: comoFecha(fila.fechaInicio),
    fin: comoFecha(fila.fechaFin),
    anulacion: fila.fechaAnulacion ? fechaLocal(fila.fechaAnulacion) : null,
  }))

  return dias.map((dia) => contratos.filter((contrato) =>
    contrato.inicio <= dia &&
    (contrato.fin === null || contrato.fin >= dia) &&
    (contrato.anulacion === null || contrato.anulacion > dia)
  ).length)
}

async function contarFirmados(idInmobiliaria, desde, hasta) {
  const [filas] = await db.execute(
    `SELECT COUNT(*) AS total
     FROM contratos c
     INNER JOIN estadosContratos ec
       ON ec.id = c.idEstadoContrato
     WHERE c.idInmobiliaria = ?
       AND ec.nombre NOT IN (${marcadores(ESTADOS_SIN_VIGENCIA)})
       AND c.fechaFirma >= ?
       AND c.fechaFirma < ?`,
    [idInmobiliaria, ...ESTADOS_SIN_VIGENCIA, desde, hasta]
  )
  return Number(filas[0].total)
}

async function contarPorAgente(idInmobiliaria, limite = 5) {
  const [filas] = await db.execute(
    `SELECT
       p.idAgente,
       SUM(tc.nombre = 'Venta') AS ventas,
       SUM(tc.nombre = 'Alquiler') AS alquileres
     FROM contratos c
     INNER JOIN tiposContratos tc
       ON tc.id = c.idTipoContrato
     INNER JOIN estadosContratos ec
       ON ec.id = c.idEstadoContrato
     INNER JOIN propiedades p
       ON p.id = c.idPropiedad
       AND p.idInmobiliaria = c.idInmobiliaria
     WHERE c.idInmobiliaria = ?
       AND ec.nombre NOT IN (${marcadores(ESTADOS_SIN_VIGENCIA)})
       AND p.idAgente IS NOT NULL
     GROUP BY p.idAgente
     ORDER BY (ventas + alquileres) DESC, ventas DESC, p.idAgente
     LIMIT ?`,
    [idInmobiliaria, ...ESTADOS_SIN_VIGENCIA, limite]
  )
  return filas.map((fila) => ({ idAgente: fila.idAgente, ventas: Number(fila.ventas), alquileres: Number(fila.alquileres) }))
}

async function inquilinosVigentes(idInmobiliaria, idsPropiedades, dia, conexion = db) {
  if (!idsPropiedades.length) {
    return []
  }
  const [filas] = await conexion.execute(
    `SELECT
       c.idPropiedad,
       c.id AS idContrato,
       per.id AS idPersona,
       per.nombre,
       per.apellido,
       c.fechaAnulacion
     FROM contratos c
     INNER JOIN tiposContratos tc
       ON tc.id = c.idTipoContrato
     INNER JOIN estadosContratos ec
       ON ec.id = c.idEstadoContrato
     INNER JOIN contratosPersonas cp
       ON cp.idContrato = c.id
       AND cp.idInmobiliaria = c.idInmobiliaria
     INNER JOIN tiposParticipacion tp
       ON tp.id = cp.idTipoParticipacion
     INNER JOIN personas per
       ON per.id = cp.idPersona
       AND per.idInmobiliaria = cp.idInmobiliaria
     WHERE c.idInmobiliaria = ?
       AND c.idPropiedad IN (${marcadores(idsPropiedades)})
       AND tc.nombre = 'Alquiler'
       AND tp.nombre = 'Inquilino'
       AND ec.nombre NOT IN (${marcadores(ESTADOS_SIN_VIGENCIA)})
       AND c.fechaInicio <= ?
       AND (${FIN_EFECTIVO} IS NULL OR ${FIN_EFECTIVO} >= ?)
     ORDER BY c.idPropiedad, c.id, per.id`,
    [idInmobiliaria, ...idsPropiedades, ...ESTADOS_SIN_VIGENCIA, dia, dia]
  )
  return filas
    .filter((fila) => !fila.fechaAnulacion || fechaLocal(fila.fechaAnulacion) > dia)
    .map(({ fechaAnulacion, ...fila }) => fila)
}

async function alquilerVigenteDe(idInmobiliaria, idPersona, dia) {
  const [filas] = await db.execute(
    `SELECT
       c.id,
       c.idPropiedad,
       p.nombre AS propiedad,
       p.ubicacion AS propiedadUbicacion,
       c.fechaInicio,
       ${FIN_EFECTIVO} AS fechaFin,
       c.montoAcordado,
       c.moneda,
       c.fechaAnulacion
     FROM contratos c
     INNER JOIN tiposContratos tc
       ON tc.id = c.idTipoContrato
     INNER JOIN estadosContratos ec
       ON ec.id = c.idEstadoContrato
     INNER JOIN contratosPersonas cp
       ON cp.idContrato = c.id
       AND cp.idInmobiliaria = c.idInmobiliaria
     INNER JOIN tiposParticipacion tp
       ON tp.id = cp.idTipoParticipacion
     INNER JOIN propiedades p
       ON p.id = c.idPropiedad
       AND p.idInmobiliaria = c.idInmobiliaria
     WHERE c.idInmobiliaria = ?
       AND cp.idPersona = ?
       AND tc.nombre = 'Alquiler'
       AND tp.nombre = 'Inquilino'
       AND ec.nombre NOT IN (${marcadores(ESTADOS_SIN_VIGENCIA)})
       AND c.fechaInicio <= ?
       AND (${FIN_EFECTIVO} IS NULL OR ${FIN_EFECTIVO} >= ?)
     ORDER BY ${FIN_EFECTIVO} IS NULL, ${FIN_EFECTIVO}, c.id`,
    [idInmobiliaria, idPersona, ...ESTADOS_SIN_VIGENCIA, dia, dia]
  )

  const vigente = filas.find((fila) => !fila.fechaAnulacion || fechaLocal(fila.fechaAnulacion) > dia)
  if (!vigente) {
    return null
  }
  const { fechaAnulacion, ...contrato } = vigente
  return {
    ...contrato,
    fechaInicio: comoFecha(contrato.fechaInicio),
    fechaFin: comoFecha(contrato.fechaFin),
    montoAcordado: Number(contrato.montoAcordado),
  }
}

function alcance(usuario) {
  const condiciones = ["c.idInmobiliaria = ?"]
  const parametros = [usuario.idInmobi]
  if (ROLES_PARTICIPANTES.includes(usuario.rol)) {
    condiciones.push(`EXISTS (
      SELECT 1
      FROM contratosPersonas cpa
      INNER JOIN usuarios ua
        ON ua.idPersona = cpa.idPersona
        AND ua.idInmobiliaria = cpa.idInmobiliaria
      WHERE cpa.idContrato = c.id
        AND cpa.idInmobiliaria = c.idInmobiliaria
        AND ua.id = ?
    )`)
    parametros.push(usuario.id)
  }
  return { condiciones, parametros }
}

async function participantesDe(idInmobiliaria, idsContratos, conexion = db) {
  if (!idsContratos.length) {
    return []
  }
  const [filas] = await conexion.execute(
    `SELECT
       cp.idContrato,
       cp.idPersona,
       per.nombre,
       per.apellido,
       tp.nombre AS rol
     FROM contratosPersonas cp
     INNER JOIN tiposParticipacion tp
       ON tp.id = cp.idTipoParticipacion
     INNER JOIN personas per
       ON per.id = cp.idPersona
       AND per.idInmobiliaria = cp.idInmobiliaria
     WHERE cp.idInmobiliaria = ?
       AND cp.idContrato IN (${marcadores(idsContratos)})
     ORDER BY cp.idContrato, tp.id, per.apellido, per.nombre`,
    [idInmobiliaria, ...idsContratos]
  )
  return filas
}

function agruparPorContrato(filas) {
  const grupos = new Map()
  for (const { idContrato, ...fila } of filas) {
    if (!grupos.has(idContrato)) grupos.set(idContrato, [])
    grupos.get(idContrato).push(fila)
  }
  return grupos
}

async function listar(usuario, filtros = {}) {
  const { page = 1, limit = 10 } = filtros
  const { condiciones, parametros } = alcance(usuario)

  if (filtros.tipo) {
    condiciones.push("tc.nombre = ?")
    parametros.push(filtros.tipo)
  }
  if (filtros.estado) {
    condiciones.push("ec.nombre = ?")
    parametros.push(filtros.estado)
  }
  if (filtros.idPropiedad) {
    condiciones.push("c.idPropiedad = ?")
    parametros.push(filtros.idPropiedad)
  }
  if (filtros.hasta) {
    condiciones.push("COALESCE(c.fechaInicio, c.fechaFirma) <= ?")
    parametros.push(filtros.hasta)
  }
  if (filtros.desde) {
    condiciones.push(`COALESCE(${FIN_EFECTIVO}, c.fechaInicio, c.fechaFirma) >= ?`)
    parametros.push(filtros.desde)
  }

  const donde = `WHERE ${condiciones.join(" AND ")}`
  const offset = (page - 1) * limit
  const [[filas], [conteo]] = await Promise.all([
    db.execute(`${SELECT_CONTRATO} ${donde} ORDER BY COALESCE(c.fechaInicio, c.fechaFirma) DESC, c.id DESC LIMIT ? OFFSET ?`, [...parametros, limit, offset]),
    db.execute(
      `SELECT COUNT(*) AS total
       FROM contratos c
       INNER JOIN tiposContratos tc ON tc.id = c.idTipoContrato
       INNER JOIN estadosContratos ec ON ec.id = c.idEstadoContrato
       ${donde}`,
      parametros
    ),
  ])

  const participantes = agruparPorContrato(await participantesDe(usuario.idInmobi, filas.map((fila) => fila.id)))
  const total = Number(conteo[0].total)
  return {
    items: filas.map((fila) => ({ ...normalizar(fila), participantes: participantes.get(fila.id) || [] })),
    paginacion: { pagina: page, limite: limit, total, paginas: Math.ceil(total / limit) },
  }
}

async function buscarPorId(usuario, id, conexion = db) {
  const { condiciones, parametros } = alcance(usuario)
  const [filas] = await conexion.execute(`${SELECT_CONTRATO} WHERE ${condiciones.join(" AND ")} AND c.id = ?`, [...parametros, id])
  if (!filas.length) {
    return null
  }
  const [participantes, docs] = await Promise.all([
    participantesDe(usuario.idInmobi, [id], conexion),
    documentos.listarDeContratos(usuario, [id]),
  ])
  return {
    ...normalizar(filas[0]),
    participantes: participantes.map(({ idContrato, ...participante }) => participante),
    documentos: docs.map(({ idContrato, ...documento }) => documento),
  }
}

async function idsDeCatalogo(conexion) {
  const [[tipos], [estados], [roles]] = await Promise.all([
    conexion.execute(`SELECT id, nombre FROM tiposContratos`),
    conexion.execute(`SELECT id, nombre FROM estadosContratos`),
    conexion.execute(`SELECT id, nombre FROM tiposParticipacion`),
  ])
  const mapa = (filas) => Object.fromEntries(filas.map((fila) => [fila.nombre, fila.id]))
  return { tipos: mapa(tipos), estados: mapa(estados), roles: mapa(roles) }
}

async function haySolapamiento(conexion, idInmobiliaria, idPropiedad, inicio, fin, excluir = null) {
  const [filas] = await conexion.execute(
    `SELECT c.id
     FROM contratos c
     INNER JOIN tiposContratos tc ON tc.id = c.idTipoContrato
     INNER JOIN estadosContratos ec ON ec.id = c.idEstadoContrato
     WHERE c.idInmobiliaria = ?
       AND c.idPropiedad = ?
       AND tc.nombre = 'Alquiler'
       AND ec.nombre NOT IN (${marcadores(ESTADOS_SIN_VIGENCIA)})
       AND c.id <> ?
       AND c.fechaInicio <= ?
       AND (${FIN_EFECTIVO} IS NULL OR ${FIN_EFECTIVO} >= ?)
     LIMIT 1
     FOR UPDATE`,
    [idInmobiliaria, idPropiedad, ...ESTADOS_SIN_VIGENCIA, excluir ?? 0, fin, inicio]
  )
  return filas.length > 0
}

async function insertarContrato(conexion, usuario, catalogo, datos) {
  const [resultado] = await conexion.execute(
    `INSERT INTO contratos
       (idInmobiliaria, idTipoContrato, idEstadoContrato, idPropiedad, idContratoAnterior,
        fechaFirma, fechaInicio, fechaFin, mesesDeAviso, mesesAumento, tipoAumento, valorAumentoFijo,
        condiciones, montoAcordado, moneda, periodicidadPago)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      usuario.idInmobi, catalogo.tipos[datos.tipo], catalogo.estados[datos.estado], datos.idPropiedad, datos.idContratoAnterior ?? null,
      datos.fechaFirma ?? null, datos.fechaInicio ?? null, datos.fechaFin ?? null, datos.mesesDeAviso ?? 0,
      datos.mesesAumento ?? null, datos.tipoAumento ?? null, datos.valorAumentoFijo ?? null,
      datos.condiciones ?? null, datos.montoAcordado, datos.moneda ?? "ARS", datos.periodicidadPago,
    ]
  )

  for (const participante of datos.participantes) {
    await conexion.execute(
      `INSERT INTO contratosPersonas (idInmobiliaria, idContrato, idPersona, idTipoParticipacion) VALUES (?, ?, ?, ?)`,
      [usuario.idInmobi, resultado.insertId, participante.idPersona, catalogo.roles[participante.rol]]
    )
  }
  return resultado.insertId
}

async function marcarPropiedadContratada(conexion, idInmobiliaria, idPropiedad, tipo) {
  const estado = tipo === "Venta" ? "Vendida" : "Alquilada"
  await conexion.execute(
    `UPDATE propiedades p
     INNER JOIN estadosComerciales ec ON ec.nombre = ?
     SET p.idEstadoComercial = ec.id, p.operacion = ?
     WHERE p.id = ? AND p.idInmobiliaria = ?`,
    [estado, tipo, idPropiedad, idInmobiliaria]
  )
}

async function avisarContrato(conexion, usuario, id, idPropiedad, titulo, estado) {
  const idInmobiliaria = usuario.idInmobi
  const [[propiedad]] = await conexion.execute(
    "SELECT nombre, idAgente FROM propiedades WHERE idInmobiliaria = ? AND id = ?",
    [idInmobiliaria, idPropiedad]
  )
  const participantes = await participantesDe(idInmobiliaria, [id], conexion)
  await guardar(conexion, {
    idInmobiliaria,
    tipo: "Contrato",
    titulo,
    contenido: `${propiedad.nombre}. El contrato #${id} figura como ${estado.toLowerCase()}.`,
    roles: [ADMIN],
    idsPersonas: participantes.map(({ idPersona }) => idPersona),
    idAgente: propiedad.idAgente,
    excluirUsuario: usuario.id,
  })
}

async function crear(usuario, cuerpo) {
  const conexion = await db.getConnection()
  try {
    await conexion.beginTransaction()
    const [propiedades] = await conexion.execute(
      `SELECT p.id FROM propiedades p WHERE p.id = ? AND p.idInmobiliaria = ? FOR UPDATE`,
      [cuerpo.idPropiedad, usuario.idInmobi]
    )
    if (!propiedades.length) {
      await conexion.rollback()
      return { error: "NO_ENCONTRADO", mensaje: "La propiedad no existe" }
    }

    const idsPersonas = [...new Set(cuerpo.participantes.map((participante) => participante.idPersona))]
    const [personas] = await conexion.execute(
      `SELECT
         per.id,
         EXISTS (SELECT 1 FROM propietarios pr WHERE pr.idPersona = per.id AND pr.idInmobiliaria = per.idInmobiliaria) AS esPropietario,
         EXISTS (SELECT 1 FROM inquilinos i WHERE i.idPersona = per.id AND i.idInmobiliaria = per.idInmobiliaria) AS esInquilino,
         (
           EXISTS (SELECT 1 FROM agentes a WHERE a.idPersona = per.id AND a.idInmobiliaria = per.idInmobiliaria)
           OR EXISTS (SELECT 1 FROM usuarios u WHERE u.idPersona = per.id AND u.idRol IN (${marcadores(ROLES_PERSONAL)}))
         ) AS esPersonal
       FROM personas per
       WHERE per.idInmobiliaria = ? AND per.id IN (${marcadores(idsPersonas)})`,
      [...ROLES_PERSONAL, usuario.idInmobi, ...idsPersonas]
    )
    if (personas.length !== idsPersonas.length) {
      await conexion.rollback()
      return { error: "NO_ENCONTRADO", mensaje: "Algún participante no existe en la inmobiliaria" }
    }
    const problemas = participantesConRolInvalido(cuerpo.participantes, personas)
    if (problemas.length) {
      await conexion.rollback()
      return { error: "DATOS_INVALIDOS", detalles: problemas }
    }

    if (cuerpo.tipo === "Alquiler" && cuerpo.estado === "Vigente" &&
      await haySolapamiento(conexion, usuario.idInmobi, cuerpo.idPropiedad, cuerpo.fechaInicio, cuerpo.fechaFin)) {
      await conexion.rollback()
      return { error: "CONFLICTO", mensaje: "La propiedad ya tiene un alquiler en ese período" }
    }

    const catalogo = await idsDeCatalogo(conexion)
    const id = await insertarContrato(conexion, usuario, catalogo, cuerpo)
    await marcarPropiedadContratada(conexion, usuario.idInmobi, cuerpo.idPropiedad, cuerpo.tipo)
    if (cuerpo.estado !== "Borrador") {
      await avisarContrato(conexion, usuario, id, cuerpo.idPropiedad, "Nuevo contrato", cuerpo.estado)
    }
    await conexion.commit()
    return { contrato: await buscarPorId(usuario, id) }
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}

async function bloquearContrato(conexion, usuario, id) {
  const [filas] = await conexion.execute(
    `${SELECT_CONTRATO} WHERE c.idInmobiliaria = ? AND c.id = ? FOR UPDATE`,
    [usuario.idInmobi, id]
  )
  return filas[0] ? normalizar(filas[0]) : null
}

async function modificar(usuario, id, cambios) {
  const conexion = await db.getConnection()
  try {
    await conexion.beginTransaction()
    const actual = await bloquearContrato(conexion, usuario, id)
    if (!actual) {
      await conexion.rollback()
      return { error: "NO_ENCONTRADO", mensaje: "El contrato no existe" }
    }
    if (ESTADOS_BLOQUEADOS.includes(actual.estado)) {
      await conexion.rollback()
      return { error: "CONFLICTO", mensaje: `No se puede modificar un contrato ${actual.estado.toLowerCase()}` }
    }
    if (cambios.estado && !["Borrador", "Vigente"].includes(actual.estado)) {
      await conexion.rollback()
      return { error: "CONFLICTO", mensaje: "Solo se puede cambiar el estado de un contrato en borrador o vigente" }
    }

    const resultante = { ...actual, ...cambios }
    const problemas = reglasDeContrato(actual.tipo, resultante)
    if (problemas.length) {
      await conexion.rollback()
      return { error: "DATOS_INVALIDOS", detalles: problemas }
    }

    if (actual.tipo === "Alquiler" && resultante.estado === "Vigente" &&
      await haySolapamiento(conexion, usuario.idInmobi, actual.idPropiedad, resultante.fechaInicio, resultante.fechaRescision && resultante.fechaRescision < resultante.fechaFin ? resultante.fechaRescision : resultante.fechaFin, id)) {
      await conexion.rollback()
      return { error: "CONFLICTO", mensaje: "La propiedad ya tiene un alquiler en ese período" }
    }

    const campos = CAMPOS_CONTRATO.filter((campo) => campo in cambios)
    const asignaciones = campos.map((campo) => `${campo} = ?`)
    const valores = campos.map((campo) => cambios[campo])
    if (cambios.estado) {
      const catalogo = await idsDeCatalogo(conexion)
      asignaciones.push("idEstadoContrato = ?")
      valores.push(catalogo.estados[cambios.estado])
    }

    await conexion.execute(
      `UPDATE contratos SET ${asignaciones.join(", ")} WHERE id = ? AND idInmobiliaria = ?`,
      [...valores, id, usuario.idInmobi]
    )
    if (cambios.estado === "Vigente") {
      await marcarPropiedadContratada(conexion, usuario.idInmobi, actual.idPropiedad, actual.tipo)
    }
    if (cambios.estado && cambios.estado !== actual.estado) {
      await avisarContrato(conexion, usuario, id, actual.idPropiedad, "Cambió el estado del contrato", cambios.estado)
    }
    await conexion.commit()
    return { contrato: await buscarPorId(usuario, id) }
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}

async function renovar(usuario, id, cuerpo) {
  const conexion = await db.getConnection()
  try {
    await conexion.beginTransaction()
    const anterior = await bloquearContrato(conexion, usuario, id)
    if (!anterior) {
      await conexion.rollback()
      return { error: "NO_ENCONTRADO", mensaje: "El contrato no existe" }
    }
    if (anterior.tipo !== "Alquiler") {
      await conexion.rollback()
      return { error: "CONFLICTO", mensaje: "Solo se pueden renovar contratos de alquiler" }
    }
    if (!["Vigente", "Finalizado"].includes(anterior.estado)) {
      await conexion.rollback()
      return { error: "CONFLICTO", mensaje: "Solo se pueden renovar contratos vigentes o finalizados" }
    }
    if (anterior.idRenovacion) {
      await conexion.rollback()
      return { error: "CONFLICTO", mensaje: "El contrato ya fue renovado" }
    }

    const finAnterior = [anterior.fechaFin, anterior.fechaRescision].filter(Boolean).sort()[0]
    if (finAnterior && cuerpo.fechaInicio <= finAnterior) {
      await conexion.rollback()
      return { error: "DATOS_INVALIDOS", detalles: [{ campo: "fechaInicio", problema: `La renovación debe empezar después del ${finAnterior}` }] }
    }

    const heredaAumento = cuerpo.tipoAumento === undefined && cuerpo.mesesAumento === undefined && cuerpo.valorAumentoFijo === undefined
    const datos = {
      tipo: "Alquiler",
      estado: cuerpo.estado,
      idPropiedad: anterior.idPropiedad,
      idContratoAnterior: anterior.id,
      fechaFirma: cuerpo.fechaFirma ?? null,
      fechaInicio: cuerpo.fechaInicio,
      fechaFin: cuerpo.fechaFin,
      montoAcordado: cuerpo.montoAcordado,
      moneda: cuerpo.moneda ?? anterior.moneda,
      periodicidadPago: anterior.periodicidadPago,
      mesesDeAviso: anterior.mesesDeAviso,
      mesesAumento: heredaAumento ? anterior.mesesAumento : cuerpo.mesesAumento ?? null,
      tipoAumento: heredaAumento ? anterior.tipoAumento : cuerpo.tipoAumento ?? null,
      valorAumentoFijo: heredaAumento ? anterior.valorAumentoFijo : cuerpo.valorAumentoFijo ?? null,
      condiciones: cuerpo.condiciones === undefined ? anterior.condiciones : cuerpo.condiciones,
    }
    const problemas = reglasDeContrato("Alquiler", datos)
    if (problemas.length) {
      await conexion.rollback()
      return { error: "DATOS_INVALIDOS", detalles: problemas }
    }
    if (datos.estado === "Vigente" && await haySolapamiento(conexion, usuario.idInmobi, datos.idPropiedad, datos.fechaInicio, datos.fechaFin, anterior.id)) {
      await conexion.rollback()
      return { error: "CONFLICTO", mensaje: "La propiedad ya tiene un alquiler en ese período" }
    }

    const participantes = await participantesDe(usuario.idInmobi, [anterior.id], conexion)
    datos.participantes = participantes.map((participante) => ({ idPersona: participante.idPersona, rol: participante.rol }))

    const catalogo = await idsDeCatalogo(conexion)
    const nuevo = await insertarContrato(conexion, usuario, catalogo, datos)
    await marcarPropiedadContratada(conexion, usuario.idInmobi, datos.idPropiedad, datos.tipo)
    if (datos.estado !== "Borrador") {
      await avisarContrato(conexion, usuario, nuevo, datos.idPropiedad, "Contrato renovado", datos.estado)
    }
    await conexion.commit()
    return { contrato: await buscarPorId(usuario, nuevo) }
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}

async function rescindir(usuario, id, { fechaRescision, motivo }) {
  const conexion = await db.getConnection()
  try {
    await conexion.beginTransaction()
    const actual = await bloquearContrato(conexion, usuario, id)
    if (!actual) {
      await conexion.rollback()
      return { error: "NO_ENCONTRADO", mensaje: "El contrato no existe" }
    }
    if (actual.estado !== "Vigente") {
      await conexion.rollback()
      return { error: "CONFLICTO", mensaje: "Solo se pueden rescindir contratos vigentes" }
    }
    const inicio = actual.fechaInicio ?? actual.fechaFirma
    if (inicio && fechaRescision < inicio) {
      await conexion.rollback()
      return { error: "DATOS_INVALIDOS", detalles: [{ campo: "fechaRescision", problema: `No puede ser anterior al ${inicio}` }] }
    }
    if (actual.fechaFin && fechaRescision > actual.fechaFin) {
      await conexion.rollback()
      return { error: "DATOS_INVALIDOS", detalles: [{ campo: "fechaRescision", problema: `No puede ser posterior al fin del contrato (${actual.fechaFin})` }] }
    }

    const catalogo = await idsDeCatalogo(conexion)
    await conexion.execute(
      `UPDATE contratos SET idEstadoContrato = ?, fechaRescision = ?, motivoRescision = ? WHERE id = ? AND idInmobiliaria = ?`,
      [catalogo.estados.Rescindido, fechaRescision, motivo, id, usuario.idInmobi]
    )
    await avisarContrato(conexion, usuario, id, actual.idPropiedad, "Contrato rescindido", "Rescindido")
    await conexion.commit()
    return { contrato: await buscarPorId(usuario, id) }
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}

async function finalizarVencidos(hoy = fechaLocal(), conexion = db) {
  const [resultado] = await conexion.execute(
    `UPDATE contratos c
     INNER JOIN estadosContratos actual ON actual.id = c.idEstadoContrato AND actual.nombre = 'Vigente'
     INNER JOIN estadosContratos finalizado ON finalizado.nombre = 'Finalizado'
     SET c.idEstadoContrato = finalizado.id
     WHERE c.fechaFin IS NOT NULL AND c.fechaFin < ?`,
    [hoy]
  )
  return resultado.affectedRows
}

const UNA_HORA = 60 * 60 * 1000

function programarFinalizacion() {
  const ejecutar = () => finalizarVencidos().catch((error) => console.error("No se pudieron finalizar los contratos vencidos", error))
  ejecutar()
  setInterval(ejecutar, UNA_HORA).unref()
}

module.exports = {
  finalizarVencidos,
  programarFinalizacion,
  contarAlquileresVigentes,
  contarFirmados,
  contarPorAgente,
  inquilinosVigentes,
  alquilerVigenteDe,
  listar,
  buscarPorId,
  crear,
  modificar,
  renovar,
  rescindir,
}
