const ERRORES = {
  DATOS_INVALIDOS: { http: 400, mensaje: "Los datos enviados no son validos" },
  SIN_ARCHIVO: { http: 400, mensaje: "No se encontro un archivo" },
  TOKEN_FALTANTE: { http: 401, mensaje: "Debe iniciar sesion" },
  TOKEN_INVALIDO: { http: 401, mensaje: "La sesión expiró o no es válida" },
  CREDENCIALES_INVALIDAS: { http: 401, mensaje: "Usuario o contraseña incorrectos" },
  GOOGLE_TOKEN_INVALIDO: { http: 401, mensaje: "La autenticación con Google expiró o no es válida" },
  INVITACION_INVALIDA: { http: 401, mensaje: "La invitación no es válida" },
  CUENTA_NO_ACTIVADA: { http: 403, mensaje: "La cuenta todavía no fue activada" },
  CUENTA_DESACTIVADA: { http: 403, mensaje: "La cuenta está desactivada" },
  SIN_PERMISO: { http: 403, mensaje: "No tiene permiso para realizar esta acción" },
  NO_ENCONTRADO: { http: 404, mensaje: "El recurso no existe" },
  CONFLICTO: { http: 409, mensaje: "La operación genera un conflicto con datos existentes" },
  ARCHIVO_MUY_GRANDE: { http: 413, mensaje: "El archivo supera el tamaño permitido" },
  CUERPO_MUY_GRANDE: { http: 413, mensaje: "El cuerpo de la petición supera el tamaño permitido" },
  NO_FORMATO: { http: 415, mensaje: "El formato del archivo no está permitido" },
  ERROR_INTERNO: { http: 500, mensaje: "Ocurrió un error inesperado" },
  GOOGLE_NO_CONFIGURADO: { http: 500, mensaje: "Google no está configurado en el servidor" },
  NO_GUARDADO: { http: 500, mensaje: "No se pudo guardar el archivo" },
  GOOGLE_NO_DISPONIBLE: { http: 503, mensaje: "No se pudo verificar la cuenta con Google. Intentá nuevamente en unos minutos." },
}

function problema(codigo, mensaje) {
  const codigoRespuesta = Object.hasOwn(ERRORES, codigo) ? codigo : "ERROR_INTERNO"
  const error = new Error(mensaje || ERRORES[codigoRespuesta].mensaje)
  error.codigo = codigoRespuesta
  return error
}

function exito(res, data, { http = 200, paginacion } = {}) {
  const cuerpo = { status: "success", data }
  if (paginacion) {
    cuerpo.paginacion = paginacion
  }
  return res.status(http).json(cuerpo)
}

function fallo(res, codigo, { mensaje, detalles } = {}) {
  const codigoRespuesta = Object.hasOwn(ERRORES, codigo) ? codigo : "ERROR_INTERNO"
  const definido = ERRORES[codigoRespuesta]
  const error = { codigo: codigoRespuesta, mensaje: mensaje || definido.mensaje }
  if (detalles) { error.detalles = detalles }
  return res.status(definido.http).json({ status: definido.http >= 500 ? "error" : "fail", error })
}

function falloError(res, error) {

  console.error("Error de API:", error.code || error.codigo || error.name, error.message)

  if (Object.hasOwn(ERRORES, error.codigo)) {
    const mensaje = error.message && error.message !== error.codigo ? error.message : undefined
    return fallo(res, error.codigo, { mensaje, detalles: error.detalles })
  }

  switch (error.code) {
    case "ER_DUP_ENTRY": {
      return fallo(res, "CONFLICTO", { mensaje: "Ya existe un registro con esos datos" })
    }
    case "ER_NO_REFERENCED_ROW":
    case "ER_NO_REFERENCED_ROW_2":
      return fallo(res, "NO_ENCONTRADO", { mensaje: "El recurso relacionado no existe o no pertenece a esta inmobiliaria" })
    case "ER_ROW_IS_REFERENCED":
    case "ER_ROW_IS_REFERENCED_2":
      return fallo(res, "CONFLICTO", {
        mensaje: "No se puede eliminar porque el registro tiene datos asociados",
      })
    case "ER_BAD_NULL_ERROR":
    case "ER_NO_DEFAULT_FOR_FIELD":
    case "ER_DATA_TOO_LONG":
    case "ER_CHECK_CONSTRAINT_VIOLATED":
    case "ER_TRUNCATED_WRONG_VALUE":
    case "ER_TRUNCATED_WRONG_VALUE_FOR_FIELD":
      return fallo(res, "DATOS_INVALIDOS", { mensaje: "Falta un dato obligatorio o uno de los valores no es válido" })
    default:
      return fallo(res, "ERROR_INTERNO")
  }
}

module.exports = { exito, fallo, falloError, problema, ERRORES }
