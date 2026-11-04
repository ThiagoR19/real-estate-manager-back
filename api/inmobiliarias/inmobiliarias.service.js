const db = require("../../db/conexion")

const SELECT_INMOBILIARIA = `
  SELECT
    i.id,
    i.nombre AS nombre,
    i.telefono AS telefono,
    i.ubicacion AS ubicacion,
    i.dominio AS dominio,
    i.imagenLogo AS imagenLogo,
    i.fechaCreacion AS fechaCreacion
  FROM inmobiliaria i
`

async function listar(query = {}) {
    const pagina = Number(query.page || 1)
    const limite = Number(query.limit || 20)
    const offset = (pagina - 1) * limite

    const [filas, conteo] = await Promise.all([
        db.execute(`${SELECT_INMOBILIARIA} ORDER BY i.nombre, i.id LIMIT ? OFFSET ?`, [limite, offset]),db.execute(`SELECT COUNT(*) AS total FROM inmobiliaria i`),])

    const total = Number(conteo[0][0].total)
    return {
        items: filas[0],
        paginacion: {
            pagina,
            limite,
            total,
            paginas: Math.ceil(total / limite),
        },
    }
}

async function buscarPorId(id) {
    const [filas] = await db.execute(`${SELECT_INMOBILIARIA} WHERE i.id = ?`, [id])
    return filas[0] || null
}

async function crear(nombre) {
    const [resultado] = await db.execute(`INSERT INTO inmobiliaria (nombre) VALUES (?)`, [nombre])
    return buscarPorId(resultado.insertId)
}

async function actualizar(id, cuerpo = {}) {
    await db.execute(
        `UPDATE inmobiliaria
         SET nombre = ?, telefono = ?, ubicacion = ?, dominio = ?, imagenLogo = ?
         WHERE id = ?`,
        [
            cuerpo.nombre,
            cuerpo.telefono ?? null,
            cuerpo.ubicacion ?? null,
            cuerpo.dominio ?? null,
            cuerpo.imagenLogo ?? null,
            id,
        ]
    )

    return buscarPorId(id)
}

const TABLAS_DE_INMOBILIARIA = [
    "versionesDocumentos",
    "documentos",
    "mensajesAdjuntos",
    "mensajes",
    "conversacionesEstado",
    "conversaciones",
    "personasNotificaciones",
    "notificaciones",
    "tareas",
    "comprobantes",
    "cobros",
    "pagosConceptos",
    "pagos",
    "ajustesIndec",
    "ajustesAlquiler",
    "indec",
    "contratosPersonas",
    "contratos",
    "valoracionesProfesionales",
    "reportesImagenes",
    "reportes",
    "visitas",
    "clientes",
    "propiedadesServicios",
    "propiedadesImagenes",
    "propiedadesPersonas",
    "propiedades",
    "agentes",
    "propietarios",
    "inquilinos",
    "profesionales",
    "areas",
    "usuarios",
    "personas",
]

async function eliminar(id) {
    const conexion = await db.getConnection()
    try {
        await conexion.beginTransaction()
        const [filas] = await conexion.execute(`SELECT i.id FROM inmobiliaria i WHERE i.id = ? FOR UPDATE`, [id])
        if (!filas.length) { await conexion.rollback(); return false }

        await conexion.execute(`DELETE t FROM tokensAcceso t INNER JOIN usuarios u ON u.id = t.idUsuario WHERE u.idInmobiliaria = ?`, [id])
        await conexion.execute(`DELETE a FROM auditoria a LEFT JOIN usuarios u ON u.id = a.idUsuario WHERE a.idInmobiliaria = ? OR u.idInmobiliaria = ?`, [id, id])
        await conexion.execute(`UPDATE contratos SET idContratoAnterior = NULL WHERE idInmobiliaria = ?`, [id])

        for (const tabla of TABLAS_DE_INMOBILIARIA) {
            await conexion.execute(`DELETE FROM ${tabla} WHERE idInmobiliaria = ?`, [id])
        }

        await conexion.execute(`DELETE FROM inmobiliaria WHERE id = ?`, [id])
        await conexion.commit()
        return true
    } catch (error) {
        await conexion.rollback()
        throw error
    } finally {
        conexion.release()
    }
}

module.exports = { listar, buscarPorId, crear, actualizar, eliminar }
