const router = require("express").Router();
const controller = require("./infoInmobiliaria.controller")

router.get("/:id", controller.consultar)
router.get("/:id/propiedades", controller.propiedades)
router.get("/:id/propiedades/:idPropiedad", controller.propiedad)
router.get("/:id/catalogo", controller.catalogo)

module.exports = router
