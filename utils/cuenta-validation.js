const AppError = require("./app-error")

const CAMPOS_PERSONA = ["nombre", "apellido", "correo", "dni", "telefono", "direccion"]
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function error(mensaje) {
  return new AppError("DATOS_INVALIDOS", mensaje)
}

function validarCuerpo(cuerpo) {
  if (!cuerpo || typeof cuerpo !== "object" || Array.isArray(cuerpo)) {
    throw error("El cuerpo de la petición debe ser un objeto")
  }
}

function validarTexto(valor, campo, { obligatorio = false, maximo = 255 } = {}) {
  if (valor === undefined || valor === null || valor === "") {
    if (obligatorio) throw error(`El campo "${campo}" es obligatorio`)
    return null
  }

  if (typeof valor !== "string") {
    throw error(`El campo "${campo}" debe ser texto`)
  }

  const resultado = valor.trim()

  if (obligatorio && !resultado) {
    throw error(`El campo "${campo}" es obligatorio`)
  }

  if (resultado.length > maximo) {
    throw error(`El campo "${campo}" no puede superar los ${maximo} caracteres`)
  }

  return resultado || null
}

function validarCorreo(correo) {
  if (correo && !EMAIL.test(correo)) {
    throw error('El campo "correo" no tiene un formato válido')
  }
}

function validarPassword(password, obligatorio = false) {
  if (password === undefined || password === null || password === "") {
    if (obligatorio) throw error('El campo "password" es obligatorio')
    return undefined
  }

  if (typeof password !== "string" || password.length < 8) {
    throw error('El campo "password" debe tener al menos 8 caracteres')
  }

  return password
}

function validarUsuario(usuario, obligatorio = false) {
  if (usuario === undefined || usuario === null || usuario === "") {
    if (obligatorio) throw error('El campo "usuario" es obligatorio')
    return undefined
  }

  if (typeof usuario !== "string") {
    throw error('El campo "usuario" debe ser texto')
  }

  const resultado = usuario.trim()

  if (resultado.length < 3 || resultado.length > 255) {
    throw error('El campo "usuario" debe tener entre 3 y 255 caracteres')
  }

  return resultado
}

function validarId(valor, campo) {
  const id = Number(valor)

  if (!Number.isInteger(id) || id <= 0) {
    throw error(`El campo "${campo}" debe ser un entero positivo`)
  }

  return id
}

function validarIdOpcional(valor, campo) {
  if (valor === undefined) return undefined
  if (valor === null || valor === "") return null
  return validarId(valor, campo)
}

function validarPersona(cuerpo, parcial = false) {
  const datos = {}
  const obligatorios = parcial ? [] : ["nombre", "apellido", "correo", "dni"]

  for (const campo of CAMPOS_PERSONA) {
    if (parcial && !Object.prototype.hasOwnProperty.call(cuerpo, campo)) continue

    datos[campo] = validarTexto(cuerpo[campo], campo, {
      obligatorio: obligatorios.includes(campo),
    })
  }

  if (datos.correo) validarCorreo(datos.correo)
  return datos
}

function validarCrearCuenta(cuerpo, { inmobiliariaObligatoria = false } = {}) {
  validarCuerpo(cuerpo)

  const datos = validarPersona(cuerpo)
  datos.usuario = validarUsuario(cuerpo.usuario, true)
  datos.password = validarPassword(cuerpo.password, true)

  if (inmobiliariaObligatoria || Object.prototype.hasOwnProperty.call(cuerpo, "idInmobiliaria")) {
    if (cuerpo.idInmobiliaria === undefined || cuerpo.idInmobiliaria === null) {
      if (inmobiliariaObligatoria) {
        throw error('El campo "idInmobiliaria" es obligatorio')
      }
    } else {
      datos.idInmobiliaria = validarId(cuerpo.idInmobiliaria, "idInmobiliaria")
    }
  }

  return datos
}

function validarActualizarCuenta(cuerpo, { permiteArea = false } = {}) {
  validarCuerpo(cuerpo)

  const datos = validarPersona(cuerpo, true)
  const usuario = validarUsuario(cuerpo.usuario)
  const password = validarPassword(cuerpo.password)

  if (usuario !== undefined) datos.usuario = usuario
  if (password !== undefined) datos.password = password

  if (permiteArea && Object.prototype.hasOwnProperty.call(cuerpo, "idArea")) {
    datos.idArea = validarIdOpcional(cuerpo.idArea, "idArea")
  }

  if (Object.keys(datos).length === 0) {
    throw error("Debe enviar al menos un campo para actualizar")
  }

  return datos
}

function validarIdRecurso(valor, nombre = "id") {
  return validarId(valor, nombre)
}

function validarListado(query = {}) {
  const pagina = query.page === undefined ? 1 : Number(query.page)
  const limite = query.limit === undefined ? 20 : Number(query.limit)
  const busqueda = query.q === undefined
    ? ""
    : validarTexto(query.q, "q", { maximo: 100 }) || ""

  if (!Number.isInteger(pagina) || pagina <= 0) {
    throw error('El parámetro "page" debe ser un entero positivo')
  }

  if (!Number.isInteger(limite) || limite <= 0 || limite > 100) {
    throw error('El parámetro "limit" debe ser un entero entre 1 y 100')
  }

  return {
    pagina,
    limite,
    offset: (pagina - 1) * limite,
    busqueda,
  }
}

module.exports = {
  validarCrearCuenta,
  validarActualizarCuenta,
  validarIdRecurso,
  validarListado,
}
