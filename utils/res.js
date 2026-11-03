const ERRORES = {
    DATOS_INVALIDOS: { http: 400, mensaje: "Los datos enviados no son validos" },
    TOKEN_FALTANTE: { http: 401, mensaje: "Debe iniciar sesion" },
    TOKEN_INVALIDO: { http: 401, mensaje: "La sesión expiró o no es válida" },
    CREDENCIALES_INVALIDAS: { http: 401, mensaje: "Usuario o contraseña incorrectos" },
    INVITACION_INVALIDA: { http: 401, mensaje: "La invitación no es válida" },
    CUENTA_NO_ACTIVADA: { http: 403, mensaje: "La cuenta todavía no fue activada" },
    CUENTA_DESACTIVADA: { http: 403, mensaje: "La cuenta está desactivada" },
    SIN_PERMISO: { http: 403, mensaje: "No tiene permiso para realizar esta acción" },
    NO_ENCONTRADO: { http: 404, mensaje: "El recurso no existe" },
    CONFLICTO: { http: 409, mensaje: "La operación genera un conflicto con datos existentes" },
    ERROR_INTERNO: { http: 500, mensaje: "Ocurrió un error inesperado" },
}

function exito(res, data, { http = 200, paginacion } = {}) {
    const cuerpo = { status: "success", data }
    if (paginacion) {
        cuerpo.paginacion = paginacion
    }
    return res.status(http).json(cuerpo)
}

function fallo(res, codigo, { mensaje, detalles } = {}) {
    const definido = ERRORES[codigo] || ERRORES.ERROR_INTERNO
    const error = { codigo, mensaje: mensaje || definido.mensaje }
    if (detalles) {
        error.detalles = detalles
    }

    return res.status(definido.http).json({ status: definido.http >= 500 ? "error" : "fail", error, })
}

module.exports = { exito, fallo, ERRORES }
