const mysql = require("mysql2/promise")
const { host, user, password, database } = require("../config/env").db

const db = mysql.createPool({
  host,
  database,
  user,
  password,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: "Z"
})



module.exports = db;