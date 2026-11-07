const { exito, fallo } = require("../../utils/res")
const service = require("./chats.service")

async function listar(req, res, next){
  const userId = req.usuario.id

  try{
    const datos = await service.listar(userId)
    exito(res, datos)
  }
  catch(error){
    return next(error)
  }
}
module.exports = {listar}