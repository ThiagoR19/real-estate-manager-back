require("dotenv/config")

const express = require('express');
const PORT = process.env.PORT

const variablesRequeridas = ["DB_HOST", "DB_USER", "DB_NAME", "TOKEN_SECRET", "FRONT_URL", "PORT"]
for (const variable of variablesRequeridas) {
  if (!process.env[variable]) throw new Error(`Falta la variable ${variable} en el .env`)
}

const app = express()

const corsConfig = require("./middlewares/cors")
const apiRouter = require("./api/api")
const { ZodError } = require("zod")
const { fallo, falloError } = require("./utils/res")
const path = require("path");

const { iniciarSocket } = require("./sockets/sockets")
const { programarFinalizacion } = require("./api/contratos/contratos.service")

app.use(corsConfig)
app.use(express.json())
app.use("/uploads/chats", (req, res) => fallo(res, "NO_ENCONTRADO", { mensaje: "La ruta no existe" }))
app.use("/uploads", express.static(path.join(__dirname, "uploads")))

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
  falloError(res, err)
})

const servidor = app.listen(PORT, (e) => {
  if (e) { console.log(e); process.exit(1) }
  console.log(`Server corriendo en http://localhost:${PORT}`)
  programarFinalizacion()
})

iniciarSocket(servidor)
