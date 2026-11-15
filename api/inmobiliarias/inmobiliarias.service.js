const db = require("../../db/conexion")
const ciudadesBuenosAires = require("../../db/ciudadesBuenosAires")

const SELECT_INMOBILIARIA = `
  SELECT
    i.id,
    i.nombre AS nombre,
    i.telefono AS telefono,
    i.ubicacion AS ubicacion,
    i.dominio AS dominio,
    i.imagenLogo AS imagenLogo,
    i.imagenBanner AS imagenBanner,
    i.imagenPrincipal AS imagenPrincipal,
    i.fechaCreacion AS fechaCreacion
  FROM inmobiliaria i
`

// Carpeta de uploads de cada imagen (el logo ya vivía en "logos")
const CARPETAS_IMAGENES = { imagenLogo: "logos", imagenBanner: "inmobiliarias", imagenPrincipal: "inmobiliarias" }

const url = (columna, nombre) => (nombre ? `/uploads/${CARPETAS_IMAGENES[columna]}/${nombre}` : null)

const conUrls = (fila) => fila && ({
    ...fila,
    urlLogo: url("imagenLogo", fila.imagenLogo),
    urlBanner: url("imagenBanner", fila.imagenBanner),
    urlPrincipal: url("imagenPrincipal", fila.imagenPrincipal),
})

async function listar(query = {}) {
    const pagina = Number(query.page || 1)
    const limite = Number(query.limit || 10)
    const offset = (pagina - 1) * limite

    const [filas, conteo] = await Promise.all([
        db.execute(`${SELECT_INMOBILIARIA} ORDER BY i.nombre, i.id LIMIT ? OFFSET ?`, [limite, offset]),db.execute(`SELECT COUNT(*) AS total FROM inmobiliaria i`),])
        
    const total = Number(conteo[0][0].total)
    return {
        items: filas[0].map(conUrls),
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
    return conUrls(filas[0]) || null
}

async function crear(nombre) {
    const conexion = await db.getConnection()
    let id
    try {
        await conexion.beginTransaction()
        const [resultado] = await conexion.execute(`INSERT INTO inmobiliaria (nombre) VALUES (?)`, [nombre])
        id = resultado.insertId
        for (const ciudad of ciudadesBuenosAires) {
            await conexion.execute(`INSERT INTO areas (idInmobiliaria, nombre) VALUES (?, ?)`, [id, ciudad])
        }
        await conexion.commit()
    } catch (error) {
        await conexion.rollback()
        throw error
    } finally {
        conexion.release()
    }
    return buscarPorId(id)
}

const CAMPOS_EDITABLES = ["nombre", "telefono", "ubicacion", "dominio", "imagenLogo", "imagenBanner", "imagenPrincipal"]

// Actualiza solo los campos que vienen en cuerpo (undefined = no se toca; null = se borra)
async function actualizar(id, cuerpo = {}) {
    const campos = CAMPOS_EDITABLES.filter((campo) => cuerpo[campo] !== undefined)

    if (campos.length) {
        await db.execute(
            `UPDATE inmobiliaria
             SET ${campos.map((campo) => `${campo} = ?`).join(", ")}
             WHERE id = ?`,
            [...campos.map((campo) => cuerpo[campo]), id]
        )
    }

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
    "comprobantes",
    "cobrosConceptos",
    "cobros",
    "pagosConceptos",
    "pagos",
    "conceptosPago",
    "ajustesIndec",
    "ajustesAlquiler",
    "indec",
    "contratosPersonas",
    "contratos",
    "valoracionesProfesionales",
    "reportesImagenes",
    "reportes",
    "visitas",
    "contVisitas",
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

module.exports = { listar, buscarPorId, crear, actualizar, eliminar, CARPETAS_IMAGENES }
