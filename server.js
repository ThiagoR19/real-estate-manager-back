const express = require('express');
const corsConfig = require("./middlewares/cors")
const PORT = require("./config/env").port
const apiRouter = require("./api/api")
const app = express()

app.use(corsConfig)
app.use(express.json())
app.use('/api', apiRouter);

app.use((req, res, next) => {
  console.log('El usuario intentó acceder a ', req.path)
  res.status(404).send('Página no encontrada')
})

app.listen(PORT, (e) => {
  if (e) { console.log(e); process.exit(1) }
  console.log(`Sever corriendo en http://localhost:${PORT}`)
})