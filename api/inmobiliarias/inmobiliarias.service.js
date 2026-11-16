const db = require("../../db/conexion")
const ciudadesBuenosAires = require("../../db/ciudadesBuenosAires")
const { limpiar } = require("../../utils/adjuntos")

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
    const conexion = await db.getConnection()
    try {
        await conexion.beginTransaction()
        const [anteriores] = await conexion.execute(
            "SELECT imagenLogo FROM inmobiliaria WHERE id = ? FOR UPDATE", [id]
        )
        if (!anteriores.length) { await conexion.rollback(); return null }

        if (campos.length) {
            await conexion.execute(
                `UPDATE inmobiliaria
                 SET ${campos.map((campo) => `${campo} = ?`).join(", ")}
                 WHERE id = ?`,
                [...campos.map((campo) => cuerpo[campo]), id]
            )
        }

        const [filas] = await conexion.execute(`${SELECT_INMOBILIARIA} WHERE i.id = ?`, [id])
        await conexion.commit()
        return { inmobiliaria: filas[0], imagenLogoAnterior: anteriores[0].imagenLogo }
    } catch (error) {
        await conexion.rollback()
        throw error
    } finally {
        conexion.release()
    }
}

const TABLAS_DE_INMOBILIARIA = [
    "auditoria",
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
    let archivosAEliminar = []
    let idsUsuarios = []
    try {
        await conexion.beginTransaction()
        const [filas] = await conexion.execute(`SELECT i.id, i.imagenLogo FROM inmobiliaria i WHERE i.id = ? FOR UPDATE`, [id])
        if (!filas.length) { await conexion.rollback(); return false }

        const [adjuntos] = await conexion.execute(
            `SELECT rutaArchivo FROM mensajesAdjuntos WHERE idInmobiliaria = ?`, [id]
        )
        archivosAEliminar = adjuntos.flatMap(({ rutaArchivo }) => {
            const ruta = String(rutaArchivo).replace(/\\/g, "/")
            const coincidencia = /^(?:(privado|uploads)\/)?chats\/([^/]+)$/.exec(ruta)
            if (!coincidencia) return []
            return [{ destino: "chats", nombre: coincidencia[2], privado: coincidencia[1] === "privado" }]
        })
        for (const [tabla, columna, destino, privado] of [
            ["personas", "fotoPerfil", "perfiles", false],
            ["propiedadesImagenes", "nombre", "propiedades", false],
            ["reportesImagenes", "nombre", "reportes", false],
            ["versionesDocumentos", "rutaArchivo", "documentos", true],
        ]) {
            const [filasArchivos] = await conexion.execute(
                `SELECT ${columna} AS nombre FROM ${tabla} WHERE idInmobiliaria = ?`, [id]
            )
            archivosAEliminar.push(...filasArchivos
                .filter(({ nombre }) => nombre)
                .map(({ nombre }) => ({ destino, nombre, privado })))
        }
        if (filas[0].imagenLogo) {
            archivosAEliminar.push({ destino: "logos", nombre: filas[0].imagenLogo, privado: false })
        }
        const [usuarios] = await conexion.execute("SELECT id FROM usuarios WHERE idInmobiliaria = ?", [id])
        idsUsuarios = usuarios.map(({ id }) => id)

        await conexion.execute(`DELETE t FROM tokensAcceso t INNER JOIN usuarios u ON u.id = t.idUsuario WHERE u.idInmobiliaria = ?`, [id])
        await conexion.execute(`DELETE a FROM auditoria a INNER JOIN usuarios u ON u.id = a.idUsuario WHERE u.idInmobiliaria = ?`, [id])
        await conexion.execute(`UPDATE contratos SET idContratoAnterior = NULL WHERE idInmobiliaria = ?`, [id])

        for (const tabla of TABLAS_DE_INMOBILIARIA) {
            await conexion.execute(`DELETE FROM ${tabla} WHERE idInmobiliaria = ?`, [id])
        }

        await conexion.execute(`DELETE FROM inmobiliaria WHERE id = ?`, [id])
        await conexion.commit()
    } catch (error) {
        await conexion.rollback()
        throw error
    } finally {
        conexion.release()
    }
    try {
        const { desconectarUsuario } = require("../../sockets/sockets")
        for (const idUsuario of idsUsuarios) desconectarUsuario(idUsuario)
    } catch (error) {
        console.error("No se pudieron cerrar los sockets de la inmobiliaria eliminada", error)
    }
    await limpiar(archivosAEliminar)
    return true
}

module.exports = { listar, buscarPorId, crear, actualizar, eliminar, CARPETAS_IMAGENES }
