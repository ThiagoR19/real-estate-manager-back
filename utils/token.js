require("dotenv/config")

const jwt = require("jsonwebtoken")
const TOKEN_SECRET = process.env.TOKEN_SECRET

function crearTokenS(nombre, apellido, idRol, idUsuario, idInmobi) {
  const payload = {
    rol: idRol,
    id: idUsuario,
    nombre: nombre,
    apellido: apellido,
    idInmobi: idInmobi,
    tipo: "Sesion"
  }
  let token = jwt.sign(payload, TOKEN_SECRET, { expiresIn: "14d" })
  return token
}
function verificarToken(token) {
  try {
    return jwt.verify(token, TOKEN_SECRET)
  } catch (error) {
    return null
  }
}

function crearTokenVisita(idInmobiliaria) {
  const token = jwt.sign({ idInmobi: idInmobiliaria, tipo: "Visita" }, TOKEN_SECRET, { expiresIn: "24h" })
  return { token, expira: new Date(jwt.decode(token).exp * 1000).toISOString() }
}

function leerTokenVisita(token) {
  let datos
  try {
    datos = jwt.verify(token, TOKEN_SECRET, { ignoreExpiration: true })
  } catch (error) {
    return { estado: "INVALIDO" }
  }
  if (datos.tipo !== "Visita" || !Number.isInteger(datos.idInmobi) || !datos.exp) {
    return { estado: "INVALIDO" }
  }
  const expira = new Date(datos.exp * 1000)
  return { estado: expira > new Date() ? "VIGENTE" : "VENCIDO", idInmobiliaria: datos.idInmobi, expira: expira.toISOString() }
}

module.exports = { crearTokenS, verificarToken, crearTokenVisita, leerTokenVisita }
