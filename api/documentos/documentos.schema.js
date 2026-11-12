const { z } = require("zod")

const vacioAIndefinido = (valor) => typeof valor === "string" && valor.trim() === "" ? undefined : valor

const TIPOS = ["CONTRATO", "ESCRITURA", "DNI", "GARANTIA", "RESCISION", "RECIBO", "OTRO"]
const VINCULOS = ["idPropiedad", "idContrato", "idPersona", "idReporte", "idCobro"]

const id = z.coerce.number().int().positive().max(2147483647)
const idOpcional = z.preprocess(vacioAIndefinido, id.optional())
const titulo = z.string().trim().min(1).max(255)
const tipo = z.preprocess((valor) => typeof valor === "string" ? valor.trim().toUpperCase() : valor, z.enum(TIPOS))
const visibilidad = z.enum(["INTERNA", "PARTES"])
const motivo = z.string().trim().min(3).max(500)

const tieneVinculo = (cuerpo) => VINCULOS.some((campo) => cuerpo[campo] !== undefined)

const crearDocumentoSchema = z.object({
  titulo,
  tipo,
  visibilidad: z.preprocess(vacioAIndefinido, visibilidad.default("INTERNA")),
  ...Object.fromEntries(VINCULOS.map((campo) => [campo, idOpcional])),
}).strict().refine(tieneVinculo, {
  message: "Debe vincular el documento a una propiedad, contrato, persona, reporte o cobro",
  path: ["vinculo"],
})

const nuevaVersionSchema = z.object({
  comentario: motivo,
}).strict()

const actualizarDocumentoSchema = z.object({
  titulo: titulo.optional(),
  tipo: tipo.optional(),
  visibilidad: visibilidad.optional(),
}).strict().refine((cuerpo) => Object.keys(cuerpo).length > 0, {
  message: "Debe enviar al menos un dato para actualizar",
})

const archivarDocumentoSchema = z.object({
  motivo,
  confirmacion: z.literal(true),
}).strict()

const desarchivarDocumentoSchema = z.object({
  confirmacion: z.literal(true),
}).strict()

const idDocumentoSchema = z.object({ id }).strict()
const idVersionSchema = z.object({ id, numero: id }).strict()

const documentosQuerySchema = z.object({
  ...Object.fromEntries(VINCULOS.map((campo) => [campo, idOpcional])),
  tipo: z.preprocess(vacioAIndefinido, tipo.optional()),
  archivados: z.preprocess(vacioAIndefinido, z.enum(["true", "false"]).default("false")),
  page: z.preprocess(vacioAIndefinido, z.coerce.number().int().min(1).max(1000000).default(1)),
  limit: z.preprocess(vacioAIndefinido, z.coerce.number().int().min(1).max(10).default(10)),
}).strict()

module.exports = {
  VINCULOS,
  crearDocumentoSchema,
  nuevaVersionSchema,
  actualizarDocumentoSchema,
  archivarDocumentoSchema,
  desarchivarDocumentoSchema,
  idDocumentoSchema,
  idVersionSchema,
  documentosQuerySchema,
}
