const service = require("./inmobiliarias.service")
const { exito, fallo } = require("../../utils/res")
const archivos = require("../../utils/archivos")

async function listar(req, res, next) {
    try {
        const resultado = await service.listar(req.query)
        return exito(res, resultado.items, { paginacion: resultado.paginacion })
    }
    catch (error) {
        return next(error)
    }
}

async function crear(req, res, next) {
    //con zod verificar si el nombre no es undefined
    try {
        const inmobiliaria = await service.crear(req.body.nombre)
        return exito(res, inmobiliaria, { http: 201 })
    }
    catch (error) {
        return next(error)
    }
}
async function eliminar(req, res, next) {
    const { id } = req.params
    const resultado = await service.eliminar(id)
    if (!resultado) {
        return fallo(res, "NO_ENCONTRADO", { mensaje: "La inmobiliaria no existe" })
    }
    return exito(res, null)
}
async function consultar(req, res, next) {
    const id = Number(req.usuario.idInmobi)
    const resultado = await service.buscarPorId(id)
    if (!resultado) {
        return fallo(res, "NO_ENCONTRADO", { mensaje: "La inmobiliaria no existe" })

    }
    return exito(res, resultado)
}
async function editar(req, res, next) {
    let datos = req.body
    const imgsCont = await archivos(req.files.logo, "logos")
    if(imgsCont.codigo != "EXITO"){
        return fallo(res,imgsCont.codigo)
    }
    datos.imagenLogo = imgsCont.nombre
    try {
        const id = Number(req.usuario.idInmobi)

        const resultado = await service.actualizar(id, datos)
        if (resultado) {
            return exito(res, resultado)
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