const service = require("./inmobiliarias.service")
const { exito, fallo } = require("../../utils/res")

const CARPETA_LOGOS = path.join(__dirname, "../../uploads/logos")

async function listar(req, res, next) {
    try {
        const resultado = await service.listar(req.query)
        exito(res, resultado.items, { paginacion: resultado.paginacion })
    }
    catch (error) {
        next(error)
    }
}

async function crear(req, res, next) {
    //con zod verificar si el nombre no es undefined
    try {
        const inmobiliaria = await service.crear(req.body.nombre)
        exito(res, inmobiliaria, { http: 201 })
    }
    catch (error) {
        next(error)
    }
}
async function eliminar(req, res, next) {
    const { id } = req.params
    const resultado = await service.eliminar(id)
    if (!resultado) {
        return fallo(res, "NO_ENCONTRADO", { mensaje: "La inmobiliaria no existe" })
    }
    exito(res, null)
}
async function consultar(req, res, next) {
    const id = Number(req.usuario.idInmobi)
    const resultado = await service.buscarPorId(id)
    if (!resultado) {
        return fallo(res, "NO_ENCONTRADO", { mensaje: "La inmobiliaria no existe" })

    }
    exito(res, resultado)
}
async function editar(req, res, next) {
    const files = req.files
    try {
        const id = Number(req.usuario.idInmobi)
        const datos = req.body

        const resultado = await service.actualizar(id,)
        if (resultado) {
            exito(res, resultado)
        }
        return fallo(res, "NO_ENCONTRADO", { mensaje: "La inmobiliaria no existe" })
    }
    catch(error) {
    if (error.code === "ER_DUP_ENTRY") {
        return fallo(res, "CONFLICTO", { mensaje: "Ese dominio ya está en uso" })
    }
    return next(error)
}
}
module.exports = { listar, crear, eliminar, consultar, editar }