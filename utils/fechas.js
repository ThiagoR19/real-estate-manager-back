const ZONA_HORARIA = "America/Argentina/Buenos_Aires"
const DESFASE = "-03:00"
const UN_DIA = 24 * 60 * 60 * 1000

const dosDigitos = (numero) => String(numero).padStart(2, "0")

function fechaLocal(fecha = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_HORARIA, year: "numeric", month: "2-digit", day: "2-digit" }).format(fecha)
}

const sumarDias = (dia, dias) => new Date(Date.parse(`${dia}T00:00:00Z`) + dias * UN_DIA).toISOString().slice(0, 10)

const diaDeLaSemana = (dia) => (new Date(`${dia}T00:00:00Z`).getUTCDay() + 6) % 7

const ultimoDiaDelMes = (anio, mes) => new Date(Date.UTC(anio, mes, 0)).getUTCDate()

function mesDe(dia) {
  const [anio, mes] = dia.split("-").map(Number)
  return {
    anio,
    mes,
    inicio: `${anio}-${dosDigitos(mes)}-01`,
    siguiente: mes === 12 ? `${anio + 1}-01-01` : `${anio}-${dosDigitos(mes + 1)}-01`,
    anterior: mes === 1 ? `${anio - 1}-12-01` : `${anio}-${dosDigitos(mes - 1)}-01`,
  }
}

function rangoDelDia(dia) {
  const inicio = new Date(`${dia}T00:00:00${DESFASE}`)
  return { inicio, fin: new Date(inicio.getTime() + UN_DIA) }
}

module.exports = { dosDigitos, fechaLocal, sumarDias, diaDeLaSemana, ultimoDiaDelMes, mesDe, rangoDelDia }
