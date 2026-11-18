INSERT INTO reportesImagenes (idInmobiliaria, idReporte, nombre)
SELECT r.idInmobiliaria, r.id, '8414853068_a71ec481ef_b.jpg'
FROM reportes r
WHERE NOT EXISTS (
  SELECT 1
  FROM reportesImagenes ri
  WHERE ri.idInmobiliaria = r.idInmobiliaria
    AND ri.idReporte = r.id
);
