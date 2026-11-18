-- Separa la disponibilidad por operación conservando la operación de las propiedades existentes.
START TRANSACTION;

INSERT IGNORE INTO estadosComerciales (nombre) VALUES
  ('Disponible Venta'), ('Disponible Alquiler');

UPDATE propiedades p
INNER JOIN estadosComerciales actual ON actual.id = p.idEstadoComercial
INNER JOIN estadosComerciales destino ON destino.nombre = CASE p.operacion
  WHEN 'Alquiler' THEN 'Disponible Alquiler'
  ELSE 'Disponible Venta'
END
SET p.idEstadoComercial = destino.id
WHERE actual.nombre = 'Disponible';

DELETE FROM estadosComerciales WHERE nombre = 'Disponible';

UPDATE propiedades p
INNER JOIN estadosComerciales ec ON ec.id = p.idEstadoComercial
SET p.operacion = CASE
  WHEN ec.nombre IN ('Disponible Alquiler', 'Alquilada') THEN 'Alquiler'
  ELSE 'Venta'
END
WHERE ec.nombre IN ('Disponible Venta', 'Disponible Alquiler', 'Vendida', 'Alquilada');

COMMIT;
