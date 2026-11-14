const router = require("express").Router();
const controller = require("./infoInmobiliaria.controller")

router.get("/:id", controller.consultar)

module.exports = router
