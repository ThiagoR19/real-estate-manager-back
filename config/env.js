require("dotenv").config();

const requeridas = ["DB_HOST", "DB_USER", "DB_NAME", "TOKEN_SECRET", "FRONT_URL", "PORT"];

for (const nombre of requeridas) {
  if (!process.env[nombre]) throw new Error(`Falta la variable ${nombre} en el .env`);
}

module.exports = {
  port: process.env.PORT || 3000,
  db: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  },
  jwtSecret: process.env.TOKEN_SECRET,
  frontURL: process.env.FRONT_URL,
};