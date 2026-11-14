const { z } = require("zod")

const idInmobiliariaSchema = z.object({
  id: z.coerce.number().int().positive().max(2147483647),
}).strict()

module.exports = { idInmobiliariaSchema }
