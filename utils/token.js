const jwt = require("jsonwebtoken")
const TOKEN_SECRET = require("../config/env").jwtSecret

function crearTokenS(nombre, apellido, idRol, idUsuario, idInmobi){
    const payload = {
        rol:idRol,
        id:idUsuario,
        nombre:nombre,
        apellido:apellido,
        idInmobi:idInmobi,
        tipo:"Sesion"
    }
    let token = jwt.sign(payload, TOKEN_SECRET,{expiresIn:"14d"})
    return token
}
function verificarToken(token){

    try {
        const datos = jwt.verify(token, TOKEN_SECRET);
        
        return datos;

    } catch (error) {
        console.error("Ocurrio un error con el token")
        console.error(error)
        //pedir logout
    }
}
module.exports = {crearTokenS, verificarToken}