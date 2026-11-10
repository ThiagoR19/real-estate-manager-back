const path = require("path")
const db = require("../../db/conexion")
const archivos = require("../../utils/archivos")

const TIPOS = {
  persona: { tabla: "personas", relacion: "idPersona" },
  propiedad: { tabla: "propiedades", relacion: "idPropiedad", imagenes: "propiedadesImagenes", destino: "propiedades" },
  reporte: { tabla: "reportes", relacion: "idReporte", imagenes: "reportesImagenes", destino: "reportes" },
}

function problema(codigo) {
  return Object.assign(new Error(codigo), { codigo })
}

function identificador(tipo, entidad) {
  return tipo === "persona" ? entidad.idPersona : entidad.id
}

async function bloquear(conexion, tipo, entidad) {
  const [filas] = await conexion.execute(
    `SELECT id FROM ${TIPOS[tipo].tabla} WHERE id = ? AND (idInmobiliaria <=> ?) FOR UPDATE`,
    [identificador(tipo, entidad), entidad.idInmobiliaria]
  )
  if (!filas.length) throw problema("NO_ENCONTRADO")
}

async function limpiar(lista) {
  for (const archivo of lista) {
    try {
      await archivos.eliminar(archivo.destino, archivo.nombre, archivo.privado)
    } catch (error) {
      console.error("No se pudo eliminar el archivo", archivo.nombre, error)
    }
  }
}

function incluirFotoPerfil(persona) {
  if (!persona) return persona
  return {
    ...persona,
    urlFotoPerfil: persona.fotoPerfil ? `/uploads/perfiles/${persona.fotoPerfil}` : null,
  }
}

async function incluirImagenes(tipo, entidades, conexion = db) {
  if (!entidades.length) return entidades

  const config = TIPOS[tipo]
  if (!config?.imagenes) return entidades

  const ids = entidades.map((entidad) => entidad.id)
  const inmobiliarias = [...new Set(entidades.map((entidad) => entidad.idInmobiliaria))]
  const [filas] = await conexion.execute(
    `SELECT id, idInmobiliaria, ${config.relacion}, nombre${tipo === "propiedad" ? ", orden" : ""}
     FROM ${config.imagenes}
     WHERE ${config.relacion} IN (${ids.map(() => "?").join(", ")})
       AND idInmobiliaria IN (${inmobiliarias.map(() => "?").join(", ")})
     ORDER BY ${config.relacion}${tipo === "propiedad" ? ", orden" : ""}, id`,
    [...ids, ...inmobiliarias]
  )

  const porEntidad = new Map(entidades.map((entidad) => [
    `${entidad.idInmobiliaria}:${entidad.id}`, [],
  ]))
  for (const fila of filas) {
    const clave = `${fila.idInmobiliaria}:${fila[config.relacion]}`
    const imagenes = porEntidad.get(clave)
    if (!imagenes) continue

    imagenes.push({
      id: fila.id,
      nombre: fila.nombre,
      ...(tipo === "propiedad" ? { orden: fila.orden } : {}),
      url: `/uploads/${config.destino}/${fila.nombre}`,
    })
  }

  return entidades.map((entidad) => ({
    ...entidad,
    imagenes: porEntidad.get(`${entidad.idInmobiliaria}:${entidad.id}`),
  }))
}

async function guardarLote(entradas, destino, tipos, privado = false) {
  const guardados = []
  try {
    for (const entrada of entradas) {
      const resultado = await archivos(entrada, destino, tipos, { privado })
      if (resultado.codigo !== "EXITO") throw problema(resultado.codigo)
      const nombreOriginal = path.basename(String(entrada.name || "documento.pdf").replace(/\\/g, "/")).slice(0, 255) || resultado.nombre
      guardados.push({ ...resultado, destino, privado, nombreOriginal })
    }
    return guardados
  } catch (error) {
    await limpiar(guardados)
    throw error
  }
}

async function listar(tipo, entidad, conexion = db) {
  const config = TIPOS[tipo]
  const parametros = [identificador(tipo, entidad), entidad.idInmobiliaria]
  const resultado = { documentos: [] }
  if (tipo === "persona") {
    const [filas] = await conexion.execute(
      "SELECT fotoPerfil FROM personas WHERE id = ? AND (idInmobiliaria <=> ?)", parametros
    )
    resultado.fotoPerfil = filas[0]?.fotoPerfil || null
    resultado.urlFotoPerfil = resultado.fotoPerfil ? `/uploads/perfiles/${resultado.fotoPerfil}` : null
  } else {
    const [filas] = await conexion.execute(
      `SELECT id, nombre${tipo === "propiedad" ? ", orden" : ""} FROM ${config.imagenes}
       WHERE ${config.relacion} = ? AND idInmobiliaria = ? ORDER BY ${tipo === "propiedad" ? "orden, " : ""}id`, parametros
    )
    resultado.imagenes = filas.map((imagen) => ({ ...imagen, url: `/uploads/${config.destino}/${imagen.nombre}` }))
  }
  const [documentos] = await conexion.execute(
    `SELECT d.id, d.titulo, v.id AS idVersion, v.numeroVersion, v.nombreArchivo, v.mimeType, v.tamanioBytes
     FROM documentos d INNER JOIN versionesDocumentos v
       ON v.idDocumento = d.id AND v.idInmobiliaria = d.idInmobiliaria
     WHERE d.${config.relacion} = ? AND d.idInmobiliaria = ?
     ORDER BY d.id, v.numeroVersion`, parametros
  )
  resultado.documentos = documentos
  return resultado
}

async function cargar(tipo, entidad, clase, entradas, idUsuario) {
  const config = TIPOS[tipo]
  const destino = clase === "foto" ? "perfiles" : clase === "documentos" ? "documentos" : config.destino
  const nuevos = await guardarLote(entradas, destino, clase === "documentos" ? ["pdf"] : ["imagen"], clase === "documentos")
  let conexion
  let confirmado = false
  const anteriores = []
  try {
    conexion = await db.getConnection()
    await conexion.beginTransaction()
    await bloquear(conexion, tipo, entidad)
    const id = identificador(tipo, entidad)
    const inmobiliaria = entidad.idInmobiliaria
    if (clase === "foto") {
      const [filas] = await conexion.execute("SELECT fotoPerfil FROM personas WHERE id = ? AND (idInmobiliaria <=> ?)", [id, inmobiliaria])
      if (filas[0].fotoPerfil) anteriores.push({ destino, nombre: filas[0].fotoPerfil })
      await conexion.execute("UPDATE personas SET fotoPerfil = ? WHERE id = ? AND (idInmobiliaria <=> ?)", [nuevos[0].nombre, id, inmobiliaria])
    } else if (clase === "imagenes") {
      let orden = 0
      if (tipo === "propiedad") {
        const [filas] = await conexion.execute("SELECT COALESCE(MAX(orden), -1) + 1 AS siguiente FROM propiedadesImagenes WHERE idPropiedad = ? AND idInmobiliaria = ?", [id, inmobiliaria])
        orden = Number(filas[0].siguiente)
      }
      for (const archivo of nuevos) {
        await conexion.execute(
          `INSERT INTO ${config.imagenes} (idInmobiliaria, ${config.relacion}, nombre${tipo === "propiedad" ? ", orden" : ""})
           VALUES (?, ?, ?${tipo === "propiedad" ? ", ?" : ""})`,
          [inmobiliaria, id, archivo.nombre, ...(tipo === "propiedad" ? [orden++] : [])]
        )
      }
    } else {
      for (const archivo of nuevos) {
        const [documento] = await conexion.execute(
          `INSERT INTO documentos (idInmobiliaria, ${config.relacion}, titulo, tipo) VALUES (?, ?, ?, 'PDF')`,
          [inmobiliaria, id, archivo.nombreOriginal]
        )
        await conexion.execute(
          `INSERT INTO versionesDocumentos
           (idInmobiliaria, idDocumento, numeroVersion, nombreArchivo, rutaArchivo, mimeType, tamanioBytes, idUsuarioAutor)
           VALUES (?, ?, 1, ?, ?, ?, ?, ?)`,
          [inmobiliaria, documento.insertId, archivo.nombreOriginal, archivo.nombre, archivo.mimeType, archivo.tamanioBytes, idUsuario]
        )
      }
    }
    const resultado = await listar(tipo, entidad, conexion)
    await conexion.commit()
    confirmado = true
    await limpiar(anteriores)
    return resultado
  } catch (error) {
    if (conexion && !confirmado) await conexion.rollback()
    throw error
  } finally {
    conexion?.release()
    if (!confirmado) await limpiar(nuevos)
  }
}

async function buscarDocumento(tipo, entidad, idDocumento, conexion = db) {
  const [filas] = await conexion.execute(
    `SELECT v.nombreArchivo, v.rutaArchivo, v.mimeType FROM documentos d
     INNER JOIN versionesDocumentos v ON v.idDocumento = d.id AND v.idInmobiliaria = d.idInmobiliaria
     WHERE d.id = ? AND d.${TIPOS[tipo].relacion} = ? AND d.idInmobiliaria = ? ORDER BY v.numeroVersion DESC`,
    [idDocumento, identificador(tipo, entidad), entidad.idInmobiliaria]
  )
  return filas
}

async function eliminar(tipo, entidad, clase, idArchivo) {
  const config = TIPOS[tipo]
  const conexion = await db.getConnection()
  const anteriores = []
  try {
    await conexion.beginTransaction()
    await bloquear(conexion, tipo, entidad)
    const id = identificador(tipo, entidad)
    const inmobiliaria = entidad.idInmobiliaria
    if (clase === "foto") {
      const [filas] = await conexion.execute("SELECT fotoPerfil FROM personas WHERE id = ? AND (idInmobiliaria <=> ?)", [id, inmobiliaria])
      if (!filas[0].fotoPerfil) throw problema("NO_ENCONTRADO")
      anteriores.push({ destino: "perfiles", nombre: filas[0].fotoPerfil })
      await conexion.execute("UPDATE personas SET fotoPerfil = NULL WHERE id = ? AND (idInmobiliaria <=> ?)", [id, inmobiliaria])
    } else if (clase === "imagenes") {
      const [filas] = await conexion.execute(
        `SELECT nombre FROM ${config.imagenes} WHERE id = ? AND ${config.relacion} = ? AND idInmobiliaria = ?`,
        [idArchivo, id, inmobiliaria]
      )
      if (!filas.length) throw problema("NO_ENCONTRADO")
      anteriores.push({ destino: config.destino, nombre: filas[0].nombre })
      await conexion.execute(`DELETE FROM ${config.imagenes} WHERE id = ? AND ${config.relacion} = ? AND idInmobiliaria = ?`, [idArchivo, id, inmobiliaria])
    } else {
      const versiones = await buscarDocumento(tipo, entidad, idArchivo, conexion)
      if (!versiones.length) throw problema("NO_ENCONTRADO")
      anteriores.push(...versiones.map((version) => ({ destino: "documentos", nombre: version.rutaArchivo, privado: true })))
      await conexion.execute("DELETE FROM versionesDocumentos WHERE idDocumento = ? AND idInmobiliaria = ?", [idArchivo, inmobiliaria])
      await conexion.execute(`DELETE FROM documentos WHERE id = ? AND ${config.relacion} = ? AND idInmobiliaria = ?`, [idArchivo, id, inmobiliaria])
    }
    await conexion.commit()
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
  await limpiar(anteriores)
}

// Se ejecuta dentro de la transacción que elimina la entidad. El disco se limpia después del commit.
async function prepararEliminacion(conexion, tipo, entidad) {
  const config = TIPOS[tipo]
  const parametros = [identificador(tipo, entidad), entidad.idInmobiliaria]
  const lista = []
  if (tipo === "persona") {
    const [filas] = await conexion.execute("SELECT fotoPerfil FROM personas WHERE id = ? AND (idInmobiliaria <=> ?) FOR UPDATE", parametros)
    if (filas[0]?.fotoPerfil) lista.push({ destino: "perfiles", nombre: filas[0].fotoPerfil })
  } else {
    const [filas] = await conexion.execute(`SELECT nombre FROM ${config.imagenes} WHERE ${config.relacion} = ? AND idInmobiliaria = ?`, parametros)
    lista.push(...filas.map((fila) => ({ destino: config.destino, nombre: fila.nombre })))
    await conexion.execute(`DELETE FROM ${config.imagenes} WHERE ${config.relacion} = ? AND idInmobiliaria = ?`, parametros)
  }
  const [versiones] = await conexion.execute(
    `SELECT v.rutaArchivo FROM versionesDocumentos v INNER JOIN documentos d
     ON d.id = v.idDocumento AND d.idInmobiliaria = v.idInmobiliaria
     WHERE d.${config.relacion} = ? AND d.idInmobiliaria = ?`, parametros
  )
  lista.push(...versiones.map((version) => ({ destino: "documentos", nombre: version.rutaArchivo, privado: true })))
  await conexion.execute(
    `DELETE v FROM versionesDocumentos v INNER JOIN documentos d
     ON d.id = v.idDocumento AND d.idInmobiliaria = v.idInmobiliaria
     WHERE d.${config.relacion} = ? AND d.idInmobiliaria = ?`, parametros
  )
  await conexion.execute(`DELETE FROM documentos WHERE ${config.relacion} = ? AND idInmobiliaria = ?`, parametros)
  return lista
}

module.exports = { listar, cargar, eliminar, buscarDocumento, prepararEliminacion, limpiar, incluirFotoPerfil, incluirImagenes }
