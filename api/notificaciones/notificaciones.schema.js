const { z } = require("zod")

const idNotificacionSchema = z.object({
  id: z.coerce.number().int().positive(),
}).strict()

module.exports = { idNotificacionSchema }
