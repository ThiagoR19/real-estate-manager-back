const cors = require("cors")

const origenesPermitidos = [require("../config/env").frontURL]

module.exports = cors({
    origin: (origin, callback) => {
        if (!origin || origenesPermitidos.includes(origin)) {
            return callback(null, true)
        }
        callback(null, false)
    },
    methods: ["GET", "POST", "PUT", "PATCH","DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
})