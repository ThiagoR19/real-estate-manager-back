-- Sincroniza propiedades cargadas antes de que los contratos actualizaran el estado comercial.
UPDATE propiedades p
INNER JOIN estadosComerciales ec ON ec.nombre = CASE JSON_UNQUOTE(JSON_EXTRACT(p.datosContrato, '$.tipo'))
  WHEN 'Venta' THEN 'Vendida'
  WHEN 'Alquiler' THEN 'Alquilada'
  ELSE NULL
END
SET p.idEstadoComercial = ec.id
WHERE p.datosContrato IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM contratos c
    WHERE c.idPropiedad = p.id AND c.idInmobiliaria = p.idInmobiliaria
  );

UPDATE propiedades p
INNER JOIN estadosComerciales destino ON destino.nombre = 'Alquilada'
SET p.idEstadoComercial = destino.id
WHERE EXISTS (
  SELECT 1 FROM contratos c
  INNER JOIN tiposContratos tc ON tc.id = c.idTipoContrato AND tc.nombre = 'Alquiler'
  INNER JOIN estadosContratos ec ON ec.id = c.idEstadoContrato AND ec.nombre IN ('Borrador', 'Vigente')
  WHERE c.idPropiedad = p.id AND c.idInmobiliaria = p.idInmobiliaria
);

UPDATE propiedades p
INNER JOIN estadosComerciales destino ON destino.nombre = 'Vendida'
SET p.idEstadoComercial = destino.id
WHERE EXISTS (
  SELECT 1 FROM contratos c
  INNER JOIN tiposContratos tc ON tc.id = c.idTipoContrato AND tc.nombre = 'Venta'
  INNER JOIN estadosContratos ec ON ec.id = c.idEstadoContrato AND ec.nombre IN ('Borrador', 'Vigente', 'Finalizado')
  WHERE c.idPropiedad = p.id AND c.idInmobiliaria = p.idInmobiliaria
);
