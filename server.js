const express = require('express');
const PORT = require("./config/env").port
const app = express()

const servidor = http.createServer(app)

const corsConfig = require("./middlewares/cors")
const apiRouter = require("./api/api")
const { ZodError } = require("zod")
const { fallo } = require("./utils/res")
const path = require("path");

const { iniciarSocket } = require("./sockets/socket")

iniciarSocket(servidor)

app.use(corsConfig)
app.use(express.json())
//-----------------Temporal--------------------
app.use("/uploads", express.static(path.join(__dirname, "uploads")))
//-----------------Temporal--------------------

app.use('/api', apiRouter);
app.use((req, res, next) => {
  console.log('El usuario intentó acceder a ', req.path)
  fallo(res, "NO_ENCONTRADO", { mensaje: "La ruta no existe" })
})

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err)
  }
  if (err instanceof ZodError) {
    const detalles = err.issues.map((issue) => ({
      campo: issue.path.length ? issue.path.join(".") : "entrada",
      problema: issue.message,
    }))
    return fallo(res, "DATOS_INVALIDOS", { detalles })
  }
  if (err.type === "entity.parse.failed") {
    return fallo(res, "DATOS_INVALIDOS", { mensaje: "El cuerpo de la petición no es un JSON válido" })
  }
  if (err.type === "entity.too.large") {
    return fallo(res, "CUERPO_MUY_GRANDE")
  }
  if (err instanceof URIError) {
    return fallo(res, "DATOS_INVALIDOS", { mensaje: "La URL no es válida" })
  }
  console.error(err)
  fallo(res, "ERROR_INTERNO")
})

servidor.listen(PORT, (e) => {
  if (e) { console.log(e); process.exit(1) }
  console.log(`Server corriendo en http://localhost:${PORT}`)
})
