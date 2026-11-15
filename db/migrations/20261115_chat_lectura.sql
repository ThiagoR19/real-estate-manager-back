-- Ejecutar una vez en bases existentes antes de iniciar la API actualizada.
-- Se usa el ID del último mensaje visible al leer para evitar perder mensajes
-- enviados durante el mismo segundo que la lectura.
ALTER TABLE conversacionesEstado
  ADD COLUMN idUltimoMensajeLeido INT NULL AFTER fechaUltimaLectura;

-- Backfill conservador: los mensajes del mismo segundo quedan sin leer, pues
-- el esquema anterior no permite saber cuáles llegaron antes de la lectura.
UPDATE conversacionesEstado ce
SET ce.idUltimoMensajeLeido = (
  SELECT MAX(m.id)
  FROM mensajes m
  WHERE m.idInmobiliaria = ce.idInmobiliaria
    AND m.idConversacion = ce.idConversacion
    AND ce.fechaUltimaLectura IS NOT NULL
    AND m.fecha < ce.fechaUltimaLectura
);
