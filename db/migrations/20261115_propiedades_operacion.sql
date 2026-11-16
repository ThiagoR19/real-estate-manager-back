ALTER TABLE propiedades
  ADD COLUMN operacion VARCHAR(10) NOT NULL DEFAULT 'Venta' AFTER idTipo,
  ADD CONSTRAINT ck_24_4 CHECK (operacion IN ('Venta','Alquiler'));

UPDATE propiedades p
INNER JOIN estadosComerciales ec ON ec.id = p.idEstadoComercial
SET p.operacion = 'Alquiler'
WHERE ec.nombre = 'Alquilada';
