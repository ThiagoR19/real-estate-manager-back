const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs/promises")
const path = require("node:path")
const sharp = require("sharp")

for (const variable of ["DB_HOST", "DB_USER", "DB_NAME", "TOKEN_SECRET", "FRONT_URL", "PORT"]) {
  process.env[variable] ||= "test"
}

const service = require("../api/inmobiliarias/inmobiliarias.service")
const controller = require("../api/inmobiliarias/inmobiliarias.controller")
const carpeta = path.join(__dirname, "../uploads/logos")

async function nombres() {
  try { return (await fs.readdir(carpeta)).sort() }
  catch (error) { if (error.code === "ENOENT") return []; throw error }
}

test("un 409 al actualizar inmobiliaria elimina el logo recién subido", async () => {
  const original = service.actualizar
  const antes = await nombres()
  const data = await sharp({ create: { width: 1, height: 1, channels: 3, background: "red" } }).png().toBuffer()
  service.actualizar = async () => { throw Object.assign(new Error("duplicado"), { code: "ER_DUP_ENTRY" }) }
  try {
    const res = {
      status(code) { this.code = code; return this },
      json(body) { this.body = body; return this },
    }
    await controller.editar({ usuario: { idInmobi: 1 }, body: {}, files: { logo: { data } } }, res, (error) => { throw error })
    assert.equal(res.code, 409)
    assert.deepEqual(await nombres(), antes)
  } finally {
    service.actualizar = original
  }
})
