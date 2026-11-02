class AppError extends Error {
  constructor(codigo, mensaje, detalles) {
    super(mensaje)
    this.name = "AppError"
    this.codigo = codigo
    this.detalles = detalles
  }
}

module.exports = AppError
