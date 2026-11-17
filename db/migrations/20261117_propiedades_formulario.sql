ALTER TABLE propiedades ADD COLUMN datosContrato JSON NULL AFTER habitaciones;

INSERT IGNORE INTO servicios (nombre) VALUES
  ('Agua'), ('Gas'), ('Luz'), ('Estacionamiento');
