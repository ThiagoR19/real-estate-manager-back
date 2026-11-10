const db = require("../../db/conexion")

async function registrarDeContrato(idInmobiliaria, idContrato, { titulo, tipo, nombreArchivo, rutaArchivo, mimeType, tamanioBytes, idUsuario }) {
  const conexion = await db.getConnection()
  try {
    await conexion.beginTransaction()
    const [documento] = await conexion.execute(
      `INSERT INTO documentos (idInmobiliaria, idContrato, titulo, tipo) VALUES (?, ?, ?, ?)`,
      [idInmobiliaria, idContrato, titulo, tipo]
    )
    await conexion.execute(
      `INSERT INTO versionesDocumentos
         (idInmobiliaria, idDocumento, numeroVersion, nombreArchivo, rutaArchivo, mimeType, tamanioBytes, idUsuarioAutor)
       VALUES (?, ?, 1, ?, ?, ?, ?, ?)`,
      [idInmobiliaria, documento.insertId, nombreArchivo, rutaArchivo, mimeType, tamanioBytes, idUsuario]
    )
    await conexion.commit()
    return documento.insertId
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}

async function listarDeContratos(idInmobiliaria, idsContratos) {
  if (!idsContratos.length) {
    return []
  }
  const [filas] = await db.execute(
    `SELECT
       d.id,
       d.idContrato,
       d.titulo,
       d.tipo,
       d.fechaCreacion,
       v.numeroVersion,
       v.nombreArchivo,
       v.mimeType,
       v.tamanioBytes
     FROM documentos d
     INNER JOIN versionesDocumentos v
       ON v.idDocumento = d.id
       AND v.idInmobiliaria = d.idInmobiliaria
     WHERE d.idInmobiliaria = ?
       AND d.idContrato IN (${idsContratos.map(() => "?").join(", ")})
       AND v.numeroVersion = (
         SELECT MAX(v2.numeroVersion)
         FROM versionesDocumentos v2
         WHERE v2.idDocumento = d.id
           AND v2.idInmobiliaria = d.idInmobiliaria
       )
     ORDER BY d.fechaCreacion, d.id`,
    [idInmobiliaria, ...idsContratos]
  )
  return filas.map((fila) => ({ ...fila, tamanioBytes: fila.tamanioBytes === null ? null : Number(fila.tamanioBytes) }))
}

async function buscarDeContrato(idInmobiliaria, idContrato, idDocumento) {
  const [filas] = await db.execute(
    `SELECT
       v.nombreArchivo,
       v.rutaArchivo,
       v.mimeType
     FROM documentos d
     INNER JOIN versionesDocumentos v
       ON v.idDocumento = d.id
       AND v.idInmobiliaria = d.idInmobiliaria
     WHERE d.idInmobiliaria = ?
       AND d.idContrato = ?
       AND d.id = ?
     ORDER BY v.numeroVersion DESC
     LIMIT 1`,
    [idInmobiliaria, idContrato, idDocumento]
  )
  return filas[0] || null
}

module.exports = { registrarDeContrato, listarDeContratos, buscarDeContrato }
