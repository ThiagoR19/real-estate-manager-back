const { ADMIN, AGENTE, PROPIETARIO, INQUILINO } = require("../../config/roles")
const { guardar } = require("./notificaciones.service")

const roles = {
  [ADMIN]: "de administración",
  [AGENTE]: "de agente",
  [PROPIETARIO]: "de propietario",
  [INQUILINO]: "de inquilino",
}

async function avisarAlta(conexion, idInmobiliaria, rol, persona) {
  const nombre = [persona.nombre, persona.apellido].filter(Boolean).join(" ")
  await guardar(conexion, {
    idInmobiliaria,
    tipo: "Cuenta",
    titulo: `Nueva cuenta ${roles[rol]}`,
    contenido: nombre
      ? `Se creó la cuenta de ${nombre}. Está pendiente de activación.`
      : "Se creó una cuenta pendiente de activación.",
    roles: [ADMIN],
    paraSuperadmins: rol === ADMIN,
  })
}

async function avisarActivacion(conexion, cuenta) {
  const { idInmobi: idInmobiliaria, idRol, idPersona, idUsuario, nombre, apellido } = cuenta
  const rol = roles[idRol]
  if (!rol || !idInmobiliaria) return

  const titular = [nombre, apellido].filter(Boolean).join(" ")
  await guardar(conexion, {
    idInmobiliaria,
    tipo: "Cuenta",
    titulo: `Cuenta ${rol} activada`,
    contenido: titular ? `${titular} completó la activación de su cuenta.` : "La cuenta ya está activa.",
    roles: [ADMIN],
    excluirUsuario: idUsuario,
    paraSuperadmins: idRol === ADMIN,
  })
  await guardar(conexion, {
    idInmobiliaria,
    tipo: "Cuenta",
    titulo: "Tu cuenta está activa",
    contenido: "Ya podés acceder a las funciones de tu cuenta y completar tus datos desde Mi perfil.",
    idsPersonas: [idPersona],
  })
}

module.exports = { avisarAlta, avisarActivacion }
