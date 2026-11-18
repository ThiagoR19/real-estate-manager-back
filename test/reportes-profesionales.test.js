const test = require("node:test")
const assert = require("node:assert/strict")

const db = { execute: async () => { throw new Error("Consulta inesperada") } }
const dbPath = require.resolve("../db/conexion")
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: db }

const reportes = require("../api/reportes/reportes.service")
const profesionales = require("../api/profesionales/profesionales.service")
const { crearReporteSchema } = require("../api/reportes/reportes.schema")
const { valorarProfesionalSchema } = require("../api/profesionales/profesionales.schema")

const inquilino = { id: 8, idInmobi: 2, rol: 5 }
const propietario = { id: 9, idInmobi: 2, rol: 4 }
const agente = { id: 7, idInmobi: 2, rol: 3 }
const administrador = { id: 6, idInmobi: 2, rol: 2 }
const baseReporte = { idPropiedad: 7, idCategoria: 1, titulo: "Pérdida de agua", fecha: "2026-11-15" }

test("una fecha inexistente se rechaza antes de consultar la base", () => {
  assert.equal(crearReporteSchema.safeParse({ ...baseReporte, fecha: "2026-02-31" }).success, false)
  assert.equal(crearReporteSchema.safeParse({ ...baseReporte, fecha: "2026-02-28" }).success, true)
  assert.equal(crearReporteSchema.safeParse({ ...baseReporte, prioridad: "ALTA" }).success, false)
})

test("solo un inquilino puede crear reportes", async () => {
  db.execute = async () => { throw new Error("No debe consultar la base") }
  for (const usuario of [agente, administrador, propietario]) {
    await assert.rejects(reportes.crear(usuario, baseReporte), { codigo: "SIN_PERMISO" })
  }
})

test("el listado de reportes vacíos devuelve cero sin consultar imágenes", async () => {
  const consultas = []
  db.execute = async (sql, params) => {
    consultas.push({ sql, params })
    return sql.includes("COUNT(*)") ? [[{ total: 0 }]] : [[]]
  }
  const resultado = await reportes.listar(agente, { page: 1, limit: 5 })
  assert.deepEqual(resultado, {
    items: [],
    paginacion: { pagina: 1, limite: 5, total: 0, paginas: 0 },
  })
  assert.equal(consultas.length, 2)
  assert(consultas.every(({ sql }) => !sql.includes("prioridad")))
})

test("la lectura usa asociaciones de propiedad para propietarios y alquiler vigente para inquilinos", async () => {
  const consultas = []
  db.execute = async (sql, params) => {
    consultas.push({ sql, params })
    return sql.includes("COUNT(*)") ? [[{ total: 0 }]] : [[]]
  }
  await reportes.listar(propietario)
  assert.equal(consultas.length, 2)
  assert(consultas.every(({ sql }) => sql.includes("propiedadesPersonas") && sql.includes("tp.nombre = 'Propietario'")))
  assert(consultas.every(({ params }) => params[0] === 2 && params[1] === 9))

  consultas.length = 0
  await reportes.listar(inquilino)
  assert(consultas.every(({ sql }) => sql.includes("tc.nombre = 'Alquiler'") && sql.includes("tp.nombre = 'Inquilino'")))
  assert(consultas.every(({ sql }) => sql.includes("c.fechaInicio <= ?") && sql.includes("i.idPropiedad = r.idPropiedad") && sql.includes("i.idPropiedad IS NULL")))
  assert(consultas.every(({ params }) => params[0] === 2 && params[1] === 8 && params[2] === 8))
})

test("el catálogo limita las propiedades según el rol", async () => {
  const consultas = []
  db.execute = async (sql, params) => {
    consultas.push({ sql, params })
    return [[]]
  }
  await reportes.catalogos(propietario)
  assert(consultas[2].sql.includes("tp.nombre = 'Propietario'"))
  assert.deepEqual(consultas[2].params, [2, 9])

  consultas.length = 0
  await reportes.catalogos(inquilino)
  assert(consultas[2].sql.includes("i.idPropiedad = p.id"))
  assert(consultas[2].sql.includes("i.idPropiedad IS NULL"))
  assert.deepEqual(consultas[2].params.slice(0, 3), [2, 8, 8])
})

test("un inquilino no puede crear un reporte en una propiedad ajena", async () => {
  let huboInsercion = false
  db.execute = async (sql) => {
    if (sql.includes("FROM usuarios")) return [[{ idPersona: 20 }]]
    if (sql.includes("FROM inquilinos i")) return [[{ idPropiedad: 11 }]]
    if (sql.includes("FROM contratos c")) return [[]]
    if (sql.includes("INSERT INTO reportes")) huboInsercion = true
    throw new Error(`Consulta inesperada: ${sql}`)
  }
  await assert.rejects(reportes.crear(inquilino, baseReporte), { codigo: "SIN_PERMISO" })
  assert.equal(huboInsercion, false)
})

test("un inquilino no puede crear un reporte resuelto y el estado por defecto es Abierto", async () => {
  let insercion
  let destinatarios
  db.execute = async (sql, params) => {
    if (sql.startsWith("SELECT idPersona")) return [[{ idPersona: 20 }]]
    if (sql.startsWith("SELECT i.idPropiedad")) return [[{ idPropiedad: null }]]
    if (sql.startsWith("SELECT 1 FROM contratos c")) return [[{ 1: 1 }]]
    if (sql.startsWith("SELECT id FROM estadosReportes")) return [[{ id: 1 }]]
    if (sql.includes("INSERT INTO reportes")) {
      insercion = params
      return [{ insertId: 15 }]
    }
    if (sql.includes("FROM reportes r")) return [[{
      id: 15, idInmobiliaria: 2, idPropiedad: 7, idAgente: 12, estado: "Abierto", titulo: baseReporte.titulo,
    }]]
    if (sql.includes("FROM reportesImagenes")) return [[]]
    if (sql.includes("FROM propiedadesPersonas pp")) return [[{ idPersona: 42 }]]
    throw new Error(`Consulta inesperada: ${sql}`)
  }
  db.getConnection = async () => conexion((sql, params) => {
    if (sql.includes("SELECT u.id, u.idPersona")) {
      assert.deepEqual(params, [2, 8, 2, 42, 12])
      return [[{ id: 30, idPersona: 42 }]]
    }
    if (sql.includes("FROM tiposNotificaciones")) return [[{ id: 3 }]]
    if (sql.includes("INSERT INTO notificaciones")) return [{ insertId: 90 }]
    if (sql.includes("INSERT INTO personasNotificaciones")) {
      destinatarios = params
      return [{ affectedRows: 1 }]
    }
    if (sql.includes("c.idPropiedad IN")) return [[]]
    return db.execute(sql, params)
  })
  await assert.rejects(reportes.crear(inquilino, { ...baseReporte, idEstado: 3 }), { codigo: "SIN_PERMISO" })
  assert.equal(insercion, undefined)
  await reportes.crear(inquilino, baseReporte)
  assert.equal(insercion[3], 1)
  assert.equal(insercion[4], 20)
  assert.equal(insercion.length, 9)
  assert.deepEqual(destinatarios, [2, 90, 42])
})

test("un agente puede pasar un reporte a En proceso dentro de su inmobiliaria", async () => {
  const con = conexion(async (sql, params) => {
    if (sql.startsWith("SELECT idPropiedad, idEstado, idProfesional FROM reportes")) {
      assert.deepEqual(params, [15, 2])
      return [[{ idPropiedad: 7, idEstado: 1, idProfesional: null }]]
    }
    if (sql.startsWith("UPDATE reportes")) {
      assert.deepEqual(params, [2, 15, 2])
      return [{ affectedRows: 1 }]
    }
    if (sql.includes("FROM reportes r")) return [[{
      id: 15, idInmobiliaria: 2, idPropiedad: 7, idAgente: 12,
      idEstado: 2, estado: "En proceso", idProfesional: null,
      idPersonaReporta: 20, titulo: "Pérdida de agua",
    }]]
    return [[]]
  })
  db.getConnection = async () => con
  const actualizado = await reportes.actualizar({ id: 7, idInmobi: 2, rol: 3 }, 15, { idEstado: 2 })
  assert.equal(actualizado.estado, "En proceso")
  assert(con.acciones.includes("commit"))
})

function conexion(consultar) {
  const acciones = []
  return {
    acciones,
    async beginTransaction() { acciones.push("begin") },
    async commit() { acciones.push("commit") },
    async rollback() { acciones.push("rollback") },
    release() { acciones.push("release") },
    async execute(sql, params) { acciones.push(sql); return consultar(sql, params) },
  }
}

test("un profesional no puede tomar una persona ya asociada a otra entidad", async () => {
  const con = conexion(async (sql) => {
    if (sql.includes("FROM personas") && sql.includes("FOR UPDATE")) return [[{ id: 20 }]]
    if (sql.includes("AS ocupada")) return [[{ ocupada: 1 }]]
    throw new Error(`Consulta inesperada: ${sql}`)
  })
  db.getConnection = async () => con
  await assert.rejects(profesionales.crear({ idInmobi: 2 }, { idPersona: 20, profesion: "Plomería" }), { codigo: "CONFLICTO" })
  assert(con.acciones.includes("rollback"))
  assert(!con.acciones.some((sql) => sql.includes("INSERT INTO profesionales")))
})

test("la baja del profesional conserva una persona usada por otros registros", async () => {
  const con = conexion(async (sql) => {
    if (sql.includes("FROM profesionales pr")) return [[{ id: 10, idInmobiliaria: 2, idPersona: 20 }]]
    if (sql.includes("DELETE FROM personas")) throw Object.assign(new Error("Referencia existente"), { code: "ER_ROW_IS_REFERENCED_2" })
    return [{}]
  })
  db.getConnection = async () => con
  assert.equal(await profesionales.eliminar({ idInmobi: 2 }, 10), true)
  const desasignar = con.acciones.findIndex((sql) => sql.startsWith("UPDATE reportes SET idProfesional = NULL"))
  const eliminarValoraciones = con.acciones.findIndex((sql) => sql.startsWith("DELETE FROM valoracionesProfesionales"))
  const eliminarProfesional = con.acciones.findIndex((sql) => sql.startsWith("DELETE FROM profesionales"))
  assert(desasignar >= 0 && desasignar < eliminarProfesional)
  assert(eliminarValoraciones >= 0 && eliminarValoraciones < eliminarProfesional)
  assert(!con.acciones.some((sql) => sql.startsWith("DELETE FROM reportes")))
  assert(con.acciones.includes("ROLLBACK TO SAVEPOINT profesional_eliminado"))
  assert(con.acciones.includes("commit"))
  assert(!con.acciones.includes("rollback"))
})

test("el voto acepta solo estrellas enteras entre 1 y 5", () => {
  for (const puntuacion of [1, 3, 5]) {
    assert.equal(valorarProfesionalSchema.safeParse({ puntuacion }).success, true)
  }
  for (const puntuacion of [0, 6, 2.5, "5", null]) {
    assert.equal(valorarProfesionalSchema.safeParse({ puntuacion }).success, false)
  }
})

test("solo un agente puede votar y el voto queda limitado a su inmobiliaria", async () => {
  const consultas = []
  db.execute = async (sql, params) => {
    consultas.push({ sql, params })
    if (sql.includes("INSERT INTO votosProfesionales")) return [{ affectedRows: 0 }]
    throw new Error(`Consulta inesperada: ${sql}`)
  }
  await assert.rejects(profesionales.valorar({ id: 7, idInmobi: 2, rol: 2 }, 10, 5), { codigo: "SIN_PERMISO" })
  assert.equal(consultas.length, 0)
  await assert.rejects(profesionales.valorar({ id: 7, idInmobi: 2, rol: 3 }, 10, 5), { codigo: "NO_ENCONTRADO" })
  assert.deepEqual(consultas[0].params, [7, 5, 10, 2])
  assert(consultas[0].sql.includes("pr.idInmobiliaria = ?"))
})

test("el voto duplicado devuelve conflicto y el listado calcula promedio y voto propio", async () => {
  db.execute = async (sql) => {
    if (sql.includes("INSERT INTO votosProfesionales")) {
      throw Object.assign(new Error("Duplicado"), { code: "ER_DUP_ENTRY" })
    }
    throw new Error(`Consulta inesperada: ${sql}`)
  }
  await assert.rejects(profesionales.valorar({ id: 7, idInmobi: 2, rol: 3 }, 10, 5), {
    codigo: "CONFLICTO", message: "Ya valoraste a este profesional",
  })

  const consultas = []
  db.execute = async (sql, params) => {
    consultas.push({ sql, params })
    return sql.includes("COUNT(*) AS total") ? [[{ total: 0 }]] : [[]]
  }
  await profesionales.listar({ id: 7, idInmobi: 2, rol: 3 })
  assert(consultas[0].sql.includes("AVG(puntuacion) AS ratingPromedio"))
  assert(consultas[0].sql.includes("FROM votosProfesionales"))
  assert(consultas[0].sql.includes("votoActual.puntuacion AS miVoto"))
  assert.deepEqual(consultas[0].params, [7, 2, 10, 0])
})

test("al votar se devuelve el nuevo promedio y se marca el voto del agente", async () => {
  const consultas = []
  db.execute = async (sql, params) => {
    consultas.push({ sql, params })
    if (sql.includes("INSERT INTO votosProfesionales")) return [{ affectedRows: 1 }]
    if (sql.includes("FROM profesionales pr")) {
      return [[{ id: 10, ratingPromedio: "4.5000", cantidadResenas: 2, miVoto: 5 }]]
    }
    throw new Error(`Consulta inesperada: ${sql}`)
  }
  const resultado = await profesionales.valorar({ id: 7, idInmobi: 2, rol: 3 }, 10, 5)
  assert.equal(resultado.miVoto, 5)
  assert.equal(Number(resultado.ratingPromedio), 4.5)
  assert.deepEqual(consultas[1].params, [7, 2, 10])
})
