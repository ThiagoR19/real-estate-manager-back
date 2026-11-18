const test = require("node:test")
const assert = require("node:assert/strict")

for (const variable of ["DB_HOST", "DB_USER", "DB_NAME", "TOKEN_SECRET", "FRONT_URL", "PORT"]) {
  process.env[variable] ||= "test"
}

const db = require("../db/conexion")
const propiedades = require("../api/propiedades/propiedades.service")
const infoInmobiliaria = require("../api/infoInmobiliaria/infoInmobiliaria.service")
const contratos = require("../api/contratos/contratos.service")

test("la landing, el catálogo y el detalle públicos exigen estado Disponible", async (t) => {
  const consultas = []
  t.mock.method(db, "execute", async (sql, parametros) => {
    consultas.push({ sql, parametros })
    if (sql.includes("COUNT(*) AS total")) return [[{ total: 0 }]]
    if (sql.includes("SELECT nombre FROM tiposPropiedades")) return [[{ nombre: "Casa" }]]
    return [[]]
  })

  await propiedades.listarPublicadas(7, 6)
  await infoInmobiliaria.catalogo(7, {})
  await infoInmobiliaria.propiedad(7, 9)

  const consultasPublicas = consultas.filter(({ sql }) => sql.includes("FROM propiedades p"))
  assert.equal(consultasPublicas.length, 4)
  for (const { sql, parametros } of consultasPublicas) {
    assert.match(sql, /p\.publicada = TRUE/)
    assert.match(sql, /ec\.nombre = 'Disponible'/)
    assert.equal(parametros[0], 7)
  }
})

test("los datos de venta o alquiler determinan el estado comercial al guardar la propiedad", async (t) => {
  const escrituras = []
  const conexion = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    execute: async (sql, parametros) => {
      if (sql.startsWith("SELECT id FROM propiedades WHERE")) return [[{ id: 9 }]]
      if (sql.startsWith("SELECT id FROM estadosComerciales")) {
        return [[{ id: parametros[0] === "Vendida" ? 4 : 3 }]]
      }
      if (sql.startsWith("INSERT INTO propiedades") || sql.startsWith("UPDATE propiedades SET")) {
        escrituras.push({ sql, parametros })
        return [{ insertId: 9, affectedRows: 1 }]
      }
      throw new Error(`Consulta inesperada: ${sql}`)
    },
  }
  t.mock.method(db, "getConnection", async () => conexion)
  t.mock.method(db, "execute", async (sql) => {
    if (sql.includes("INNER JOIN estadosComerciales")) return [[{ id: 9, idInmobiliaria: 7, datosContrato: null }]]
    return [[]]
  })

  const venta = {
    tipo: "Venta", estado: "Vigente", fechaInicio: "2026-01-01", fechaFin: "2026-12-31",
    mesesAumento: 6, montoInicial: 100, tipoAumento: "FIJO", aumentoFijo: 10,
  }
  const alquiler = { ...venta, tipo: "Alquiler" }
  const usuario = { idInmobi: 7 }

  await propiedades.crear(usuario, { idTipo: 1, idEstadoComercial: 1, nombre: "Casa", datosContrato: venta })
  assert.equal(escrituras[0].parametros[1], 4)
  const ventaGuardada = JSON.parse(escrituras[0].parametros.at(-1))
  assert.equal(ventaGuardada.tipo, "Venta")
  assert.equal(ventaGuardada.fechaInicio, null)
  assert.equal(ventaGuardada.mesesAumento, null)
  assert.equal(ventaGuardada.montoInicial, null)

  await propiedades.actualizar(usuario, 9, { idEstadoComercial: 1, datosContrato: alquiler })
  assert.equal(escrituras[1].parametros[0], 3)
  assert.deepEqual(JSON.parse(escrituras[1].parametros[1]), alquiler)

  await propiedades.actualizar(usuario, 9, { datosContrato: venta })
  assert.equal(escrituras[2].parametros[0], 4)
  assert.equal(JSON.parse(escrituras[2].parametros[1]).tipo, "Venta")

  await propiedades.actualizar(usuario, 9, { idEstadoComercial: 1, datosContrato: null })
  assert.equal(escrituras[3].parametros[0], 1)
  assert.equal(escrituras[3].parametros[1], null)
})

test("crear un contrato formal marca la propiedad como vendida o alquilada", async (t) => {
  const cambiosEstado = []
  const conexion = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    execute: async (sql, parametros) => {
      if (sql.startsWith("SELECT p.id FROM propiedades")) return [[{ id: 9 }]]
      if (sql.startsWith("SELECT per.id FROM personas")) return [[{ id: 1 }, { id: 2 }]]
      if (sql.includes("FROM tiposContratos")) return [[{ id: 1, nombre: "Venta" }, { id: 2, nombre: "Alquiler" }]]
      if (sql.includes("FROM estadosContratos")) return [[{ id: 1, nombre: "Borrador" }]]
      if (sql.includes("FROM tiposParticipacion")) return [[{ id: 1, nombre: "Comprador" }, { id: 2, nombre: "Vendedor" }]]
      if (sql.startsWith("INSERT INTO contratos ") || sql.startsWith("INSERT INTO contratos\n")) return [{ insertId: 55 }]
      if (sql.startsWith("INSERT INTO contratosPersonas")) return [{ affectedRows: 1 }]
      if (sql.startsWith("UPDATE propiedades p")) {
        cambiosEstado.push({ sql, parametros })
        return [{ affectedRows: 1 }]
      }
      throw new Error(`Consulta inesperada: ${sql}`)
    },
  }
  t.mock.method(db, "getConnection", async () => conexion)
  t.mock.method(db, "execute", async () => [[]])

  const base = {
    idPropiedad: 9, estado: "Borrador", montoAcordado: 100,
    participantes: [{ idPersona: 1, rol: "Vendedor" }, { idPersona: 2, rol: "Comprador" }],
  }
  await contratos.crear({ idInmobi: 7 }, { ...base, tipo: "Venta" })
  await contratos.crear({ idInmobi: 7 }, { ...base, tipo: "Alquiler" })

  assert.deepEqual(cambiosEstado.map(({ parametros }) => parametros), [
    ["Vendida", 9, 7], ["Alquilada", 9, 7],
  ])
  assert.ok(cambiosEstado.every(({ sql }) => sql.includes("SET p.idEstadoComercial = ec.id")))
})
