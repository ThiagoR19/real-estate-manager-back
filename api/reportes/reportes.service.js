const db = require("../../db/conexion")
const enTransaccion = require("../../db/transaccion")
const { problema, limpiar, guardarLote } = require("../../utils/adjuntos")
const { fechaLocal } = require("../../utils/fechas")
const { ADMIN, PROPIETARIO, INQUILINO } = require("../../config/roles")
const { guardar } = require("../notificaciones/notificaciones.service")
const { inquilinosVigentes } = require("../contratos/contratos.service")

const FIN_EFECTIVO = "LEAST(COALESCE(c.fechaFin, c.fechaRescision), COALESCE(c.fechaRescision, c.fechaFin))"

const SELECT_REPORTE = `
  SELECT
    r.id,
    r.idInmobiliaria,
    r.idPropiedad,
    p.nombre AS propiedad,
    p.idAgente,
    r.idCategoria,
    c.nombre AS categoria,
    r.idEstado,
    e.nombre AS estado,
    r.idPersonaReporta,
    CONCAT(persona.nombre, ' ', persona.apellido) AS personaReporta,
    r.idProfesional,
    prof.profesion,
    r.prioridad,
    r.titulo,
    r.descripcion,
    r.fecha
  FROM reportes r
  INNER JOIN propiedades p
    ON p.id = r.idPropiedad AND p.idInmobiliaria = r.idInmobiliaria
  INNER JOIN categorias c ON c.id = r.idCategoria
  INNER JOIN estadosReportes e ON e.id = r.idEstado
  INNER JOIN personas persona
    ON persona.id = r.idPersonaReporta
    AND persona.idInmobiliaria = r.idInmobiliaria
  LEFT JOIN profesionales prof
    ON prof.id = r.idProfesional
    AND prof.idInmobiliaria = r.idInmobiliaria
`

function alcance(usuario, valor) {
  return usuario && usuario.idInmobi !== undefined ? usuario.idInmobi : valor
}

function condiciones(usuario, valorInmobiliaria, busqueda) {
  const inmobiliaria = alcance(usuario, valorInmobiliaria)
  const filtros = []
  const parametros = []

  if (inmobiliaria !== undefined && inmobiliaria !== null) {
    filtros.push("r.idInmobiliaria = ?")
    parametros.push(inmobiliaria)
  }
  if (usuario?.rol === PROPIETARIO) {
    filtros.push(`EXISTS (
      SELECT 1 FROM usuarios u
      INNER JOIN propiedadesPersonas pp ON pp.idPersona = u.idPersona AND pp.idInmobiliaria = u.idInmobiliaria
      INNER JOIN tiposParticipacion tp ON tp.id = pp.idTipoParticipacion
      WHERE u.id = ? AND pp.idPropiedad = r.idPropiedad
        AND pp.idInmobiliaria = r.idInmobiliaria AND tp.nombre = 'Propietario'
    )`)
    parametros.push(usuario.id)
  } else if (usuario?.rol === INQUILINO) {
    filtros.push(`(
      EXISTS (
        SELECT 1 FROM usuarios u
        INNER JOIN inquilinos i ON i.idPersona = u.idPersona AND i.idInmobiliaria = u.idInmobiliaria
        WHERE u.id = ? AND u.idInmobiliaria = r.idInmobiliaria
          AND i.idPropiedad = r.idPropiedad
      ) OR EXISTS (
        SELECT 1 FROM usuarios u
        INNER JOIN inquilinos i ON i.idPersona = u.idPersona AND i.idInmobiliaria = u.idInmobiliaria
        INNER JOIN contratosPersonas cp ON cp.idPersona = u.idPersona AND cp.idInmobiliaria = u.idInmobiliaria
        INNER JOIN tiposParticipacion tp ON tp.id = cp.idTipoParticipacion
        INNER JOIN contratos c ON c.id = cp.idContrato AND c.idInmobiliaria = cp.idInmobiliaria
        INNER JOIN tiposContratos tc ON tc.id = c.idTipoContrato
        INNER JOIN estadosContratos ec ON ec.id = c.idEstadoContrato
        WHERE u.id = ? AND c.idPropiedad = r.idPropiedad
          AND c.idInmobiliaria = r.idInmobiliaria
          AND i.idPropiedad IS NULL
          AND tp.nombre = 'Inquilino' AND tc.nombre = 'Alquiler'
          AND ec.nombre NOT IN ('Borrador', 'Anulado')
          AND c.fechaInicio <= ?
          AND (${FIN_EFECTIVO} IS NULL OR ${FIN_EFECTIVO} >= ?)
      )
    )`)
    const hoy = fechaLocal()
    parametros.push(usuario.id, usuario.id, hoy, hoy)
  }
  if (busqueda) {
    filtros.push("(r.titulo LIKE ? OR r.descripcion LIKE ? OR r.prioridad LIKE ?)")
    const texto = `%${busqueda}%`
    parametros.push(texto, texto, texto)
  }

  return {
    sql: filtros.length ? ` WHERE ${filtros.join(" AND ")}` : "",
    parametros,
    inmobiliaria,
  }
}

async function listar(usuario, query = {}) {
  const filtro = condiciones(usuario, query.idInmobiliaria, query.q)
  const pagina = Number(query.page || 1)
  const limite = Number(query.limit || 10)
  const offset = (pagina - 1) * limite

  const [filas, conteo] = await Promise.all([
    db.execute(
      `${SELECT_REPORTE}
       ${filtro.sql}
       ORDER BY r.fecha DESC, r.id DESC
       LIMIT ? OFFSET ?`,
      [...filtro.parametros, limite, offset]
    ),
    db.execute(
      `SELECT COUNT(*) AS total
       FROM reportes r
       ${filtro.sql}`,
      filtro.parametros
    ),
  ])

  const total = Number(conteo[0][0].total)
  const items = await incluirImagenes(filas[0])
  return {
    items,
    paginacion: { pagina, limite, total, paginas: Math.ceil(total / limite) },
  }
}

async function catalogos(usuario) {
  const inmobiliaria = alcance(usuario)
  const [categorias, estados, propiedades] = await Promise.all([
    db.execute("SELECT id, nombre FROM categorias ORDER BY nombre"),
    db.execute("SELECT id, nombre FROM estadosReportes ORDER BY id"),
    db.execute(`SELECT p.id, p.nombre, p.ubicacion FROM propiedades p
      WHERE p.idInmobiliaria = ?${usuario?.rol === PROPIETARIO ? ` AND EXISTS (
        SELECT 1 FROM usuarios u
        INNER JOIN propiedadesPersonas pp ON pp.idPersona = u.idPersona AND pp.idInmobiliaria = u.idInmobiliaria
        INNER JOIN tiposParticipacion tp ON tp.id = pp.idTipoParticipacion
        WHERE u.id = ? AND pp.idPropiedad = p.id AND pp.idInmobiliaria = p.idInmobiliaria
          AND tp.nombre = 'Propietario'
      )` : usuario?.rol === INQUILINO ? ` AND (
        EXISTS (
          SELECT 1 FROM usuarios u INNER JOIN inquilinos i
            ON i.idPersona = u.idPersona AND i.idInmobiliaria = u.idInmobiliaria
          WHERE u.id = ? AND i.idPropiedad = p.id AND i.idInmobiliaria = p.idInmobiliaria
        ) OR EXISTS (
          SELECT 1 FROM usuarios u
          INNER JOIN inquilinos i ON i.idPersona = u.idPersona AND i.idInmobiliaria = u.idInmobiliaria
          INNER JOIN contratosPersonas cp ON cp.idPersona = u.idPersona AND cp.idInmobiliaria = u.idInmobiliaria
          INNER JOIN tiposParticipacion tp ON tp.id = cp.idTipoParticipacion
          INNER JOIN contratos c ON c.id = cp.idContrato AND c.idInmobiliaria = cp.idInmobiliaria
          INNER JOIN tiposContratos tc ON tc.id = c.idTipoContrato
          INNER JOIN estadosContratos ec ON ec.id = c.idEstadoContrato
          WHERE u.id = ? AND i.idPropiedad IS NULL AND c.idPropiedad = p.id
            AND c.idInmobiliaria = p.idInmobiliaria AND tp.nombre = 'Inquilino'
            AND tc.nombre = 'Alquiler' AND ec.nombre NOT IN ('Borrador', 'Anulado')
            AND c.fechaInicio <= ? AND (${FIN_EFECTIVO} IS NULL OR ${FIN_EFECTIVO} >= ?)
        )
      )` : ""} ORDER BY p.nombre, p.id`,
    usuario?.rol === INQUILINO
      ? [inmobiliaria, usuario.id, usuario.id, fechaLocal(), fechaLocal()]
      : usuario?.rol === PROPIETARIO ? [inmobiliaria, usuario.id] : [inmobiliaria]),
  ])
  return { categorias: categorias[0], estados: estados[0], propiedades: propiedades[0] }
}

async function buscarPorId(usuario, id, conexion = db) {
  const filtro = condiciones(usuario)
  const where = filtro.sql
    ? `${filtro.sql} AND r.id = ?`
    : " WHERE r.id = ?"
  const [filas] = await conexion.execute(
    `${SELECT_REPORTE}${where}`,
    [...filtro.parametros, id]
  )
  if (!filas.length) return null
  const [reporte] = await incluirImagenes(filas, conexion)
  return reporte
}

async function avisarReporte(conexion, usuario, reporte, anterior) {
  const cambioPropiedad = anterior && anterior.idPropiedad !== reporte.idPropiedad
  const cambioEstado = anterior && anterior.idEstado !== reporte.idEstado
  const cambioProfesional = anterior && anterior.idProfesional !== reporte.idProfesional
  if (anterior && !cambioPropiedad && !cambioEstado && !cambioProfesional) return

  const [propietarios] = await conexion.execute(
    `SELECT pp.idPersona FROM propiedadesPersonas pp
     INNER JOIN tiposParticipacion tp ON tp.id = pp.idTipoParticipacion
     WHERE pp.idInmobiliaria = ? AND pp.idPropiedad = ? AND tp.nombre = 'Propietario'`,
    [reporte.idInmobiliaria, reporte.idPropiedad]
  )
  const inquilinos = await inquilinosVigentes(reporte.idInmobiliaria, [reporte.idPropiedad], fechaLocal(), conexion)
  const idsPersonas = [...propietarios, ...inquilinos].map(({ idPersona }) => idPersona)
  if (anterior && !cambioPropiedad && !idsPersonas.includes(reporte.idPersonaReporta)) {
    const [autores] = await conexion.execute(
      "SELECT idPersona FROM usuarios WHERE idInmobiliaria = ? AND idPersona = ? AND idRol = ?",
      [reporte.idInmobiliaria, reporte.idPersonaReporta, INQUILINO]
    )
    if (autores.length) idsPersonas.push(reporte.idPersonaReporta)
  }

  await guardar(conexion, {
    idInmobiliaria: reporte.idInmobiliaria,
    tipo: "Mantenimiento",
    titulo: anterior ? "Reporte actualizado" : "Nuevo reporte",
    contenido: `«${reporte.titulo}» en ${reporte.propiedad}. Estado: ${reporte.estado}.${cambioProfesional ? " Cambió la asignación del profesional." : ""}`,
    roles: [ADMIN],
    idsPersonas,
    idAgente: reporte.idAgente,
    excluirUsuario: usuario.id,
  })
}

async function crear(usuario, cuerpo = {}) {
  const inmobiliaria = alcance(usuario, cuerpo.idInmobiliaria)
  if (inmobiliaria === undefined || inmobiliaria === null) throw problema("DATOS_INVALIDOS")
  const [personas] = await db.execute(
    `SELECT idPersona
     FROM usuarios
     WHERE id = ? AND idInmobiliaria = ?`,
    [usuario && usuario.id, inmobiliaria]
  )
  const idPersonaReporta = personas[0]?.idPersona ?? cuerpo.idPersonaReporta
  if ((usuario?.rol === PROPIETARIO || usuario?.rol === INQUILINO) && !personas.length) {
    throw problema("SIN_PERMISO")
  }

  if (usuario?.rol === PROPIETARIO) {
    const [propiedades] = await db.execute(
      `SELECT 1 FROM propiedadesPersonas pp
       INNER JOIN tiposParticipacion tp ON tp.id = pp.idTipoParticipacion
       WHERE pp.idInmobiliaria = ? AND pp.idPropiedad = ?
         AND pp.idPersona = ? AND tp.nombre = 'Propietario' LIMIT 1`,
      [inmobiliaria, cuerpo.idPropiedad, idPersonaReporta]
    )
    if (!propiedades.length) throw problema("SIN_PERMISO")
  } else if (usuario?.rol === INQUILINO) {
    const [asignaciones] = await db.execute(
      `SELECT i.idPropiedad FROM inquilinos i
       WHERE i.idInmobiliaria = ? AND i.idPersona = ? LIMIT 1`,
      [inmobiliaria, idPersonaReporta]
    )
    if (asignaciones[0]?.idPropiedad != null) {
      if (Number(asignaciones[0].idPropiedad) !== Number(cuerpo.idPropiedad)) throw problema("SIN_PERMISO")
    } else {
      const hoy = fechaLocal()
      const [contratos] = await db.execute(
      `SELECT 1 FROM contratos c
       INNER JOIN tiposContratos tc ON tc.id = c.idTipoContrato
       INNER JOIN estadosContratos ec ON ec.id = c.idEstadoContrato
       INNER JOIN contratosPersonas cp ON cp.idContrato = c.id AND cp.idInmobiliaria = c.idInmobiliaria
       INNER JOIN tiposParticipacion tp ON tp.id = cp.idTipoParticipacion
       WHERE c.idInmobiliaria = ? AND c.idPropiedad = ?
         AND cp.idPersona = ? AND tc.nombre = 'Alquiler'
         AND tp.nombre = 'Inquilino' AND ec.nombre NOT IN ('Borrador', 'Anulado')
         AND c.fechaInicio <= ?
         AND (${FIN_EFECTIVO} IS NULL OR ${FIN_EFECTIVO} >= ?)
       LIMIT 1`,
      [inmobiliaria, cuerpo.idPropiedad, idPersonaReporta, hoy, hoy]
    )
      if (!contratos.length) throw problema("SIN_PERMISO")
    }
  }

  const [estadosAbiertos] = await db.execute(
    "SELECT id FROM estadosReportes WHERE nombre = 'Abierto' LIMIT 1"
  )
  const idEstadoAbierto = estadosAbiertos[0]?.id
  if (idEstadoAbierto === undefined) throw new Error("Falta el estado de reporte Abierto")
  if ([PROPIETARIO, INQUILINO].includes(usuario?.rol) &&
      cuerpo.idEstado !== undefined && Number(cuerpo.idEstado) !== Number(idEstadoAbierto)) {
    throw problema("SIN_PERMISO")
  }
  const idEstado = [PROPIETARIO, INQUILINO].includes(usuario?.rol)
    ? idEstadoAbierto : cuerpo.idEstado ?? idEstadoAbierto
  if ([PROPIETARIO, INQUILINO].includes(usuario?.rol) && cuerpo.idProfesional != null) {
    throw problema("SIN_PERMISO")
  }

  return enTransaccion(async (conexion) => {
    const [resultado] = await conexion.execute(
      `INSERT INTO reportes
        (idInmobiliaria, idPropiedad, idCategoria, idEstado,
         idPersonaReporta, idProfesional, prioridad, titulo,
         descripcion, fecha)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        inmobiliaria,
        cuerpo.idPropiedad,
        cuerpo.idCategoria,
        idEstado,
        idPersonaReporta,
        cuerpo.idProfesional ?? null,
        cuerpo.prioridad ?? "MEDIA",
        cuerpo.titulo,
        cuerpo.descripcion ?? null,
        cuerpo.fecha,
      ]
    )
    const reporte = await buscarPorId(usuario, resultado.insertId, conexion)
    if (reporte) await avisarReporte(conexion, usuario, reporte)
    return reporte
  })
}

async function actualizar(usuario, id, cuerpo = {}) {
  const campos = {
    idPropiedad: "idPropiedad",
    idCategoria: "idCategoria",
    idEstado: "idEstado",
    idProfesional: "idProfesional",
    prioridad: "prioridad",
    titulo: "titulo",
    descripcion: "descripcion",
    fecha: "fecha",
  }
  const cambios = Object.entries(campos)
    .filter(([campo]) => Object.hasOwn(cuerpo, campo))

  const inmobiliaria = alcance(usuario)
  const parametros = cambios.map(([campo]) => cuerpo[campo])
  const where = ["id = ?"]
  parametros.push(id)

  if (inmobiliaria !== undefined && inmobiliaria !== null) {
    where.push("idInmobiliaria = ?")
    parametros.push(inmobiliaria)
  }

  if (!cambios.length) return buscarPorId(usuario, id)

  return enTransaccion(async (conexion) => {
    const [filas] = await conexion.execute(
      `SELECT idPropiedad, idEstado, idProfesional FROM reportes WHERE ${where.join(" AND ")} FOR UPDATE`,
      parametros.slice(cambios.length)
    )
    if (!filas.length) return null

    await conexion.execute(
      `UPDATE reportes
       SET ${cambios.map(([, columna]) => `\`${columna}\` = ?`).join(", ")}
       WHERE ${where.join(" AND ")}`,
      parametros
    )
    const reporte = await buscarPorId(usuario, id, conexion)
    if (reporte) await avisarReporte(conexion, usuario, reporte, filas[0])
    return reporte
  })
}

async function eliminar(usuario, id) {
  const inmobiliaria = alcance(usuario)
  const parametros = [id]
  const where = ["id = ?"]

  if (inmobiliaria !== undefined && inmobiliaria !== null) {
    where.push("idInmobiliaria = ?")
    parametros.push(inmobiliaria)
  }

  const conexion = await db.getConnection()
  try {
    await conexion.beginTransaction()
    const [filas] = await conexion.execute(`SELECT id, idInmobiliaria FROM reportes WHERE ${where.join(" AND ")} FOR UPDATE`, parametros)
    if (!filas.length) { await conexion.rollback(); return false }
    const archivosEliminar = await prepararEliminacionArchivos(conexion, filas[0])
    await conexion.execute(`DELETE FROM reportes WHERE ${where.join(" AND ")}`, parametros)
    await conexion.commit()
    await limpiar(archivosEliminar)
    return true
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}

async function contarSinResolver(idInmobiliaria) {
  const [filas] = await db.execute(
    `SELECT COUNT(*) AS total
     FROM reportes r
     INNER JOIN estadosReportes e ON e.id = r.idEstado
     WHERE r.idInmobiliaria = ?
       AND e.nombre <> 'Resuelto'`,
    [idInmobiliaria]
  )
  return Number(filas[0].total)
}

async function listarSinRevisar(idInmobiliaria, limite = 5) {
  const [[filas], [conteo]] = await Promise.all([
    db.execute(
      `SELECT
         r.id,
         r.titulo,
         r.prioridad,
         r.fecha,
         r.idPropiedad,
         p.nombre AS propiedad,
         r.idPersonaReporta,
         CONCAT(persona.nombre, ' ', persona.apellido) AS personaReporta,
         (
           SELECT ri.nombre
           FROM reportesImagenes ri
           WHERE ri.idReporte = r.id
             AND ri.idInmobiliaria = r.idInmobiliaria
           ORDER BY ri.id
           LIMIT 1
         ) AS imagen
       FROM reportes r
       INNER JOIN estadosReportes e ON e.id = r.idEstado
       INNER JOIN propiedades p
         ON p.id = r.idPropiedad AND p.idInmobiliaria = r.idInmobiliaria
       INNER JOIN personas persona
         ON persona.id = r.idPersonaReporta
         AND persona.idInmobiliaria = r.idInmobiliaria
       WHERE r.idInmobiliaria = ?
         AND e.nombre = 'Abierto'
       ORDER BY r.fecha DESC, r.id DESC
       LIMIT ?`,
      [idInmobiliaria, limite]
    ),
    db.execute(
      `SELECT COUNT(*) AS total
       FROM reportes r
       INNER JOIN estadosReportes e ON e.id = r.idEstado
       WHERE r.idInmobiliaria = ?
         AND e.nombre = 'Abierto'`,
      [idInmobiliaria]
    ),
  ])

  return { total: Number(conteo[0].total), items: filas }
}

async function listarDePropiedades(idInmobiliaria, idsPropiedades, limite = 5, { soloSinRevisar = false, soloSinResolver = false } = {}) {
  if (!idsPropiedades.length) {
    return { total: 0, items: [] }
  }
  const enPropiedades = `r.idPropiedad IN (${idsPropiedades.map(() => "?").join(", ")})${soloSinRevisar ? " AND e.nombre = 'Abierto'" : soloSinResolver ? " AND e.nombre <> 'Resuelto'" : ""}`

  const [[filas], [conteo]] = await Promise.all([
    db.execute(
      `SELECT
         r.id,
         r.titulo,
         r.prioridad,
         r.fecha,
         e.nombre AS estado,
         r.idPropiedad,
         p.nombre AS propiedad,
         CONCAT(persona.nombre, ' ', persona.apellido) AS personaReporta,
         (
           SELECT ri.nombre
           FROM reportesImagenes ri
           WHERE ri.idReporte = r.id
             AND ri.idInmobiliaria = r.idInmobiliaria
           ORDER BY ri.id
           LIMIT 1
         ) AS imagen
       FROM reportes r
       INNER JOIN estadosReportes e ON e.id = r.idEstado
       INNER JOIN propiedades p
         ON p.id = r.idPropiedad AND p.idInmobiliaria = r.idInmobiliaria
       INNER JOIN personas persona
         ON persona.id = r.idPersonaReporta
         AND persona.idInmobiliaria = r.idInmobiliaria
       WHERE r.idInmobiliaria = ?
         AND ${enPropiedades}
       ORDER BY r.fecha DESC, r.id DESC
       LIMIT ?`,
      [idInmobiliaria, ...idsPropiedades, limite]
    ),
    db.execute(
      `SELECT COUNT(*) AS total
       FROM reportes r
       INNER JOIN estadosReportes e ON e.id = r.idEstado
       WHERE r.idInmobiliaria = ?
         AND ${enPropiedades}`,
      [idInmobiliaria, ...idsPropiedades]
    ),
  ])

  return { total: Number(conteo[0].total), items: filas }
}

async function incluirImagenes(entidades, conexion = db) {
  if (!entidades.length) return entidades
  const ids = entidades.map((entidad) => entidad.id)
  const inmobiliarias = [...new Set(entidades.map((entidad) => entidad.idInmobiliaria))]
  const [filas] = await conexion.execute(
    `SELECT id, idInmobiliaria, idReporte, nombre FROM reportesImagenes
     WHERE idReporte IN (${ids.map(() => "?").join(", ")})
       AND idInmobiliaria IN (${inmobiliarias.map(() => "?").join(", ")})
     ORDER BY idReporte, id`, [...ids, ...inmobiliarias]
  )
  const porEntidad = new Map(entidades.map((entidad) => [`${entidad.idInmobiliaria}:${entidad.id}`, []]))
  for (const fila of filas) {
    const imagenes = porEntidad.get(`${fila.idInmobiliaria}:${fila.idReporte}`)
    if (imagenes) imagenes.push({ id: fila.id, nombre: fila.nombre,
       url: `/uploads/reportes/${fila.nombre}` })
  }
  return entidades.map((entidad) => ({ ...entidad,
    imagenes: porEntidad.get(`${entidad.idInmobiliaria}:${entidad.id}`) }))
}

async function listarArchivos(entidad, conexion = db) {
  const [filas] = await conexion.execute(
    "SELECT id, nombre FROM reportesImagenes WHERE idReporte = ? AND idInmobiliaria = ? ORDER BY id",
    [entidad.id, entidad.idInmobiliaria]
  )
  return { imagenes: filas.map((imagen) => ({ ...imagen, url: `/uploads/reportes/${imagen.nombre}` })),
    documentos: await listarDocumentos(entidad, conexion) }
}

async function cargarImagenes(entidad, entradas) {
  const nuevas = await guardarLote(entradas, "reportes")
  let conexion
  let confirmado = false
  try {
    conexion = await db.getConnection()
    await conexion.beginTransaction()
    const [filas] = await conexion.execute(
      "SELECT id FROM reportes WHERE id = ? AND idInmobiliaria = ? FOR UPDATE",
      [entidad.id, entidad.idInmobiliaria]
    )
    if (!filas.length) throw problema("NO_ENCONTRADO")
    for (const nueva of nuevas) {
      await conexion.execute(
        "INSERT INTO reportesImagenes (idInmobiliaria, idReporte, nombre) VALUES (?, ?, ?)",
        [entidad.idInmobiliaria, entidad.id, nueva.nombre]
      )
    }
    const resultado = await listarArchivos(entidad, conexion)
    await conexion.commit()
    confirmado = true
    return resultado
  } catch (error) {
    if (conexion && !confirmado) await conexion.rollback()
    throw error
  } finally {
    conexion?.release()
    if (!confirmado) await limpiar(nuevas)
  }
}

async function modificarImagen(entidad, idArchivo, entradas) {
  const [nueva] = await guardarLote(entradas, "reportes")
  let conexion
  let confirmado = false
  let anterior
  try {
    conexion = await db.getConnection()
    await conexion.beginTransaction()
    const [filas] = await conexion.execute(
      "SELECT nombre FROM reportesImagenes WHERE id = ? AND idReporte = ? AND idInmobiliaria = ? FOR UPDATE",
      [idArchivo, entidad.id, entidad.idInmobiliaria]
    )
    if (!filas.length) throw problema("NO_ENCONTRADO")
    anterior = filas[0].nombre
    await conexion.execute(
      "UPDATE reportesImagenes SET nombre = ? WHERE id = ? AND idReporte = ? AND idInmobiliaria = ?",
      [nueva.nombre, idArchivo, entidad.id, entidad.idInmobiliaria]
    )
    const resultado = await listarArchivos(entidad, conexion)
    await conexion.commit()
    confirmado = true
    await limpiar([{ destino: "reportes", nombre: anterior }])
    return resultado
  } catch (error) {
    if (conexion && !confirmado) await conexion.rollback()
    throw error
  } finally {
    conexion?.release()
    if (!confirmado) await limpiar([nueva])
  }
}

async function eliminarImagen(entidad, idArchivo) {
  const conexion = await db.getConnection()
  let anterior
  try {
    await conexion.beginTransaction()
    const [filas] = await conexion.execute(
      "SELECT nombre FROM reportesImagenes WHERE id = ? AND idReporte = ? AND idInmobiliaria = ? FOR UPDATE",
      [idArchivo, entidad.id, entidad.idInmobiliaria]
    )
    if (!filas.length) throw problema("NO_ENCONTRADO")
    anterior = filas[0].nombre
    await conexion.execute(
      "DELETE FROM reportesImagenes WHERE id = ? AND idReporte = ? AND idInmobiliaria = ?",
      [idArchivo, entidad.id, entidad.idInmobiliaria]
    )
    await conexion.commit()
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
  await limpiar([{ destino: "reportes", nombre: anterior }])
}

async function prepararEliminacionArchivos(conexion, entidad) {
  const parametros = [entidad.id, entidad.idInmobiliaria]
  const [imagenes] = await conexion.execute(
    "SELECT nombre FROM reportesImagenes WHERE idReporte = ? AND idInmobiliaria = ?", parametros
  )
  const lista = imagenes.map((imagen) => ({ destino: "reportes", nombre: imagen.nombre }))
  await conexion.execute("DELETE FROM reportesImagenes WHERE idReporte = ? AND idInmobiliaria = ?", parametros)
  const [versiones] = await conexion.execute(
    `SELECT v.rutaArchivo FROM versionesDocumentos v INNER JOIN documentos d
     ON d.id = v.idDocumento AND d.idInmobiliaria = v.idInmobiliaria
     WHERE d.idReporte = ? AND d.idInmobiliaria = ?`, parametros
  )
  lista.push(...versiones.map((version) => ({ destino: "documentos", nombre: version.rutaArchivo, privado: true })))
  await conexion.execute(
    `DELETE v FROM versionesDocumentos v INNER JOIN documentos d
     ON d.id = v.idDocumento AND d.idInmobiliaria = v.idInmobiliaria
     WHERE d.idReporte = ? AND d.idInmobiliaria = ?`, parametros
  )
  await conexion.execute("DELETE FROM documentos WHERE idReporte = ? AND idInmobiliaria = ?", parametros)
  return lista
}

async function listarDocumentos(entidad, conexion = db) {
  const [filas] = await conexion.execute(
    `SELECT d.id, d.titulo, d.tipo, v.nombreArchivo, v.mimeType, v.tamanioBytes, v.numeroVersion
     FROM documentos d LEFT JOIN versionesDocumentos v
       ON v.idDocumento = d.id AND v.idInmobiliaria = d.idInmobiliaria
       AND v.numeroVersion = (SELECT MAX(numeroVersion) FROM versionesDocumentos
         WHERE idDocumento = d.id AND idInmobiliaria = d.idInmobiliaria)
     WHERE d.idReporte = ? AND d.idInmobiliaria = ? ORDER BY d.id`,
    [ entidad.id, entidad.idInmobiliaria ]
  )
  return filas
}

async function buscarDocumento(entidad, idArchivo, conexion = db) {
  const [filas] = await conexion.execute(
    `SELECT v.nombreArchivo, v.rutaArchivo, v.mimeType, v.numeroVersion
     FROM documentos d INNER JOIN versionesDocumentos v
       ON v.idDocumento = d.id AND v.idInmobiliaria = d.idInmobiliaria
     WHERE d.id = ? AND d.idReporte = ? AND d.idInmobiliaria = ?
     ORDER BY v.numeroVersion DESC`,
    [idArchivo, entidad.id, entidad.idInmobiliaria]
  )
  return filas
}

async function cargarDocumentos(entidad, entradas, idUsuario) {
  const nuevos = await guardarLote(entradas, "documentos", ["pdf"], true)
  let conexion
  let confirmado = false
  try {
    conexion = await db.getConnection()
    await conexion.beginTransaction()
    const [entidades] = await conexion.execute(
      "SELECT id FROM reportes WHERE id = ? AND idInmobiliaria = ? FOR UPDATE",
      [ entidad.id, entidad.idInmobiliaria ]
    )
    if (!entidades.length) throw problema("NO_ENCONTRADO")
    for (const nuevo of nuevos) {
      const [documento] = await conexion.execute(
        "INSERT INTO documentos (idInmobiliaria, idReporte, titulo, tipo) VALUES (?, ?, ?, 'PDF')",
        [entidad.idInmobiliaria, entidad.id, nuevo.nombreOriginal]
      )
      await conexion.execute(
        `INSERT INTO versionesDocumentos
         (idInmobiliaria, idDocumento, numeroVersion, nombreArchivo, rutaArchivo, mimeType, tamanioBytes, idUsuarioAutor)
         VALUES (?, ?, 1, ?, ?, ?, ?, ?)`,
        [entidad.idInmobiliaria, documento.insertId, nuevo.nombreOriginal, nuevo.nombre,
          nuevo.mimeType, nuevo.tamanioBytes, idUsuario]
      )
    }
    const resultado = await listarArchivos(entidad, conexion)
    await conexion.commit()
    confirmado = true
    return resultado
  } catch (error) {
    if (conexion && !confirmado) await conexion.rollback()
    throw error
  } finally {
    conexion?.release()
    if (!confirmado) await limpiar(nuevos)
  }
}

async function modificarDocumento(entidad, idArchivo, entradas, idUsuario) {
  const [nuevo] = await guardarLote(entradas, "documentos", ["pdf"], true)
  let conexion
  let confirmado = false
  try {
    conexion = await db.getConnection()
    await conexion.beginTransaction()
    const [documentos] = await conexion.execute(
      "SELECT id FROM documentos WHERE id = ? AND idReporte = ? AND idInmobiliaria = ? FOR UPDATE",
      [idArchivo, entidad.id, entidad.idInmobiliaria]
    )
    if (!documentos.length) throw problema("NO_ENCONTRADO")
    const [versiones] = await conexion.execute(
      "SELECT COALESCE(MAX(numeroVersion), 0) + 1 AS siguiente FROM versionesDocumentos WHERE idDocumento = ? AND idInmobiliaria = ?",
      [idArchivo, entidad.idInmobiliaria]
    )
    await conexion.execute(
      `INSERT INTO versionesDocumentos
       (idInmobiliaria, idDocumento, numeroVersion, nombreArchivo, rutaArchivo, mimeType, tamanioBytes, idUsuarioAutor)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [entidad.idInmobiliaria, idArchivo, Number(versiones[0].siguiente), nuevo.nombreOriginal,
        nuevo.nombre, nuevo.mimeType, nuevo.tamanioBytes, idUsuario]
    )
    const resultado = await listarArchivos(entidad, conexion)
    await conexion.commit()
    confirmado = true
    return resultado
  } catch (error) {
    if (conexion && !confirmado) await conexion.rollback()
    throw error
  } finally {
    conexion?.release()
    if (!confirmado) await limpiar([nuevo])
  }
}

async function eliminarDocumento(entidad, idArchivo) {
  const conexion = await db.getConnection()
  let versiones
  try {
    await conexion.beginTransaction()
    const [documentos] = await conexion.execute(
      "SELECT id FROM documentos WHERE id = ? AND idReporte = ? AND idInmobiliaria = ? FOR UPDATE",
      [idArchivo, entidad.id, entidad.idInmobiliaria]
    )
    if (!documentos.length) throw problema("NO_ENCONTRADO")
    versiones = await buscarDocumento(entidad, idArchivo, conexion)
    await conexion.execute(
      "DELETE FROM versionesDocumentos WHERE idDocumento = ? AND idInmobiliaria = ?",
      [idArchivo, entidad.idInmobiliaria]
    )
    await conexion.execute(
      "DELETE FROM documentos WHERE id = ? AND idReporte = ? AND idInmobiliaria = ?",
      [idArchivo, entidad.id, entidad.idInmobiliaria]
    )
    await conexion.commit()
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
  await limpiar(versiones.map((version) => ({ destino: "documentos", nombre: version.rutaArchivo, privado: true })))
}

module.exports = { listar, catalogos, buscarPorId, crear, actualizar, eliminar, contarSinResolver, listarSinRevisar, listarDePropiedades , listarArchivos, cargarImagenes, modificarImagen, eliminarImagen, listarDocumentos, buscarDocumento, modificarDocumento, cargarDocumentos, eliminarDocumento}
