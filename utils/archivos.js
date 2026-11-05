const { randomUUID } = require("crypto");
const path = require("path");

const extensionesImg = ['image/jpeg', 'image/png', 'image/webp', "application/pdf"];

async function archivos(archivo, almacenamiento) {

    try {
        if (archivo.truncated) {
            return ({ codigo: "ARCHIVO_MUY_GRANDE" })
        }

        if (extensionesImg.includes(archivo.mimetype)) {
            const extension = path.extname(archivo.name)
            const nombre = `${randomUUID()}${extension}`

            let ruta = path.join(__dirname, `../uploads/${almacenamiento}/`, nombre)

            try {
                await archivo.mv(ruta)
            }
            catch (err) {
                return ({ codigo: "NO_GUARDADO", error: err })
            }
            return ({ codigo: "EXITO", nombre: nombre })
        }

        return ({ codigo: "NO_FORMATO" })
    }
    catch {
        return ({codigo: "ERROR_INTERNO"})
    }
}

module.exports = archivos