require("dotenv").config();

const requeridas = ["DB_HOST", "DB_USER", "DB_NAME", "JWT_SECRET"];

for (const nombre of requeridas) {
  if (!process.env[nombre]) throw new Error(`Falta la variable ${nombre} en el .env`);
}

module.exports = {
  puerto: process.env.PORT || 3000,
  db: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  },
  jwtSecret: process.env.JWT_SECRET,
};