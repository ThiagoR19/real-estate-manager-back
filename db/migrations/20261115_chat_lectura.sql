


ALTER TABLE conversacionesEstado
  ADD COLUMN idUltimoMensajeLeido INT NULL AFTER fechaUltimaLectura;



UPDATE conversacionesEstado ce
SET ce.idUltimoMensajeLeido = (
  SELECT MAX(m.id)
  FROM mensajes m
  WHERE m.idInmobiliaria = ce.idInmobiliaria
    AND m.idConversacion = ce.idConversacion
    AND ce.fechaUltimaLectura IS NOT NULL
    AND m.fecha < ce.fechaUltimaLectura
);
