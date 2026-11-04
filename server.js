const express = require('express');
const corsConfig = require("./middlewares/cors")
const PORT = require("./config/env").port
const apiRouter = require("./api/api")
const { ZodError } = require("zod")
const { fallo } = require("./utils/res")
const app = express()

app.use(corsConfig)
app.use(express.json())
app.use('/api', apiRouter);

app.use((req, res, next) => {
  console.log('El usuario intentó acceder a ', req.path)
  fallo(res, "NO_ENCONTRADO", { mensaje: "La ruta no existe" })
})

app.use((err, req, res, next) => {
  if (err instanceof ZodError) {
    return fallo(res, "DATOS_INVALIDOS")
  }
  if (err.type === "entity.parse.failed") {
    return fallo(res, "DATOS_INVALIDOS", { mensaje: "El cuerpo de la petición no es un JSON válido" })
  }
  console.error(err)
  fallo(res, "ERROR_INTERNO")
})

app.listen(PORT, (e) => {
  if (e) { console.log(e); process.exit(1) }
  console.log(`Server corriendo en http://localhost:${PORT}`)
})
