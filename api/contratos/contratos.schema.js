const { z } = require("zod")

const vacioAIndefinido = (valor) => typeof valor === "string" && valor.trim() === "" ? undefined : valor
const vacioANulo = (valor) => typeof valor === "string" && valor.trim() === "" ? null : valor

const TIPOS = ["Alquiler", "Venta"]
const ESTADOS = ["Borrador", "Vigente", "Finalizado", "Rescindido", "Anulado"]
const ROLES = ["Propietario", "Inquilino", "Comprador", "Vendedor", "Garante"]

const id = z.coerce.number().int().positive().max(2147483647)
const fecha = z.iso.date()
const fechaOpcional = z.preprocess(vacioANulo, fecha.nullable().optional())
const dosDecimales = (valor) => Math.abs(Math.round(valor * 100) - valor * 100) < 1e-6
const monto = z.number().min(0).max(9999999999.99).refine(dosDecimales, "Admite hasta 2 decimales")

const camposEditables = {
  fechaFirma: fechaOpcional,
  fechaInicio: fechaOpcional,
  fechaFin: fechaOpcional,
  montoAcordado: monto,
  moneda: z.enum(["ARS", "USD"]),
  periodicidadPago: z.enum(["UNICO", "MENSUAL"]),
  mesesDeAviso: z.number().int().min(0).max(120),
  mesesAumento: z.number().int().min(1).max(120).nullable(),
  tipoAumento: z.enum(["FIJO", "INDEC"]).nullable(),
  valorAumentoFijo: monto.nullable(),
  condiciones: z.preprocess(vacioANulo, z.string().trim().max(5000).nullable()),
}

function reglasDeContrato(tipo, datos) {
  const problemas = []
  const agregar = (campo, problema) => problemas.push({ campo, problema })

  if (datos.fechaInicio && datos.fechaFin && datos.fechaFin < datos.fechaInicio) {
    agregar("fechaFin", "La fecha de fin no puede ser anterior a la de inicio")
  }

  if (tipo === "Alquiler") {
    if (!datos.fechaInicio) agregar("fechaInicio", "Un alquiler necesita fecha de inicio")
    if (!datos.fechaFin) agregar("fechaFin", "Un alquiler necesita fecha de fin")
    const conAumento = datos.tipoAumento || datos.mesesAumento || datos.valorAumentoFijo
    if (conAumento && !datos.tipoAumento) agregar("tipoAumento", "Indique si el aumento es FIJO o INDEC")
    if (conAumento && !datos.mesesAumento) agregar("mesesAumento", "Indique cada cuántos meses aumenta")
    if (datos.tipoAumento === "FIJO" && !datos.valorAumentoFijo) agregar("valorAumentoFijo", "Un aumento fijo necesita un monto mayor a 0")
    if (datos.tipoAumento === "INDEC" && datos.valorAumentoFijo) agregar("valorAumentoFijo", "Un aumento por INDEC no lleva monto fijo")
  }

  if (tipo === "Venta") {
    for (const campo of ["mesesAumento", "tipoAumento", "valorAumentoFijo"]) {
      if (datos[campo]) agregar(campo, "Una venta no tiene aumentos")
    }
  }

  return problemas
}

function reglasDeParticipantes(tipo, participantes) {
  const problemas = []
  const roles = participantes.map((participante) => participante.rol)
  const tiene = (rol) => roles.includes(rol)
  const agregar = (problema) => problemas.push({ campo: "participantes", problema })

  const repetidos = new Set()
  for (const participante of participantes) {
    const clave = `${participante.idPersona}:${participante.rol}`
    if (repetidos.has(clave)) agregar("Hay participantes repetidos con el mismo rol")
    repetidos.add(clave)
  }

  if (tipo === "Alquiler") {
    if (!tiene("Propietario")) agregar("Un alquiler necesita al menos un propietario")
    if (!tiene("Inquilino")) agregar("Un alquiler necesita al menos un inquilino")
    if (tiene("Comprador") || tiene("Vendedor")) agregar("Un alquiler no lleva compradores ni vendedores")
  }
  if (tipo === "Venta") {
    if (!tiene("Propietario") && !tiene("Vendedor")) agregar("Una venta necesita un propietario o vendedor")
    if (!tiene("Comprador")) agregar("Una venta necesita al menos un comprador")
    if (tiene("Inquilino")) agregar("Una venta no lleva inquilinos")
  }

  return [...new Set(problemas.map((problema) => problema.problema))].map((problema) => ({ campo: "participantes", problema }))
}

const agregarProblemas = (contexto, problemas) => {
  for (const { campo, problema } of problemas) {
    contexto.addIssue({ code: "custom", path: [campo], message: problema })
  }
}

const crearContratoSchema = z.object({
  idPropiedad: id,
  tipo: z.enum(TIPOS),
  estado: z.enum(["Borrador", "Vigente"]).default("Vigente"),
  ...camposEditables,
  montoAcordado: monto,
  moneda: camposEditables.moneda.default("ARS"),
  periodicidadPago: camposEditables.periodicidadPago.optional(),
  mesesDeAviso: camposEditables.mesesDeAviso.default(0),
  mesesAumento: camposEditables.mesesAumento.optional(),
  tipoAumento: camposEditables.tipoAumento.optional(),
  valorAumentoFijo: camposEditables.valorAumentoFijo.optional(),
  condiciones: camposEditables.condiciones.optional(),
  participantes: z.array(z.object({ idPersona: id, rol: z.enum(ROLES) }).strict()).min(2).max(20),
}).strict().superRefine((cuerpo, contexto) => {
  agregarProblemas(contexto, reglasDeContrato(cuerpo.tipo, cuerpo))
  agregarProblemas(contexto, reglasDeParticipantes(cuerpo.tipo, cuerpo.participantes))
}).transform((cuerpo) => ({
  ...cuerpo,
  periodicidadPago: cuerpo.periodicidadPago ?? (cuerpo.tipo === "Alquiler" ? "MENSUAL" : "UNICO"),
}))

const modificarContratoSchema = z.object({
  ...Object.fromEntries(Object.entries(camposEditables).map(([campo, regla]) => [campo, regla.optional()])),
  estado: z.enum(["Borrador", "Vigente"]).optional(),
}).strict().refine((cuerpo) => Object.keys(cuerpo).length > 0, {
  message: "Debe enviar al menos un dato para corregir",
})

const renovarContratoSchema = z.object({
  fechaFirma: fechaOpcional,
  fechaInicio: fecha,
  fechaFin: fecha,
  montoAcordado: monto,
  moneda: camposEditables.moneda.optional(),
  estado: z.enum(["Borrador", "Vigente"]).default("Vigente"),
  mesesAumento: camposEditables.mesesAumento.optional(),
  tipoAumento: camposEditables.tipoAumento.optional(),
  valorAumentoFijo: camposEditables.valorAumentoFijo.optional(),
  condiciones: camposEditables.condiciones.optional(),
}).strict()

const rescindirContratoSchema = z.object({
  fechaRescision: fecha,
  motivo: z.string().trim().min(5).max(500),
  confirmacion: z.literal(true),
}).strict()

const idContratoSchema = z.object({ id }).strict()
const idDocumentoSchema = z.object({ id, idDocumento: id }).strict()

const documentoSchema = z.object({
  nombre: z.string().trim().min(1).max(255),
}).strict()

const contratosQuerySchema = z.object({
  tipo: z.preprocess(vacioAIndefinido, z.enum(TIPOS).optional()),
  estado: z.preprocess(vacioAIndefinido, z.enum(ESTADOS).optional()),
  idPropiedad: z.preprocess(vacioAIndefinido, id.optional()),
  desde: z.preprocess(vacioAIndefinido, fecha.optional()),
  hasta: z.preprocess(vacioAIndefinido, fecha.optional()),
  page: z.preprocess(vacioAIndefinido, z.coerce.number().int().min(1).max(1000000).default(1)),
  limit: z.preprocess(vacioAIndefinido, z.coerce.number().int().min(1).max(100).default(20)),
}).strict().refine((filtros) => !filtros.desde || !filtros.hasta || filtros.desde <= filtros.hasta, {
  message: "La fecha desde no puede ser posterior a hasta",
  path: ["desde"],
})

module.exports = {
  reglasDeContrato,
  crearContratoSchema,
  modificarContratoSchema,
  renovarContratoSchema,
  rescindirContratoSchema,
  idContratoSchema,
  idDocumentoSchema,
  documentoSchema,
  contratosQuerySchema,
}
