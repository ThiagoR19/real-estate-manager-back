require("dotenv/config")

const cors = require("cors")

const origenesPermitidos = [process.env.FRONT_URL]

module.exports = cors({
  origin: (origin, callback) => {
    if (!origin || origenesPermitidos.includes("*") || origenesPermitidos.includes(origin)) {
      return callback(null, true)
    }
    callback(null, false)
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
})
