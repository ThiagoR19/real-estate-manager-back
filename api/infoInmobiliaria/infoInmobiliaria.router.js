const router = require("express").Router();
const controller = require("./infoInmobiliaria.controller")

router.get("/:id", controller.consultar)
router.get("/:id/propiedades", controller.propiedades)

module.exports = router
