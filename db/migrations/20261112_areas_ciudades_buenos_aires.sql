-- Las áreas representan ciudades/localidades, no categorías de trabajo.
ALTER TABLE areas
  MODIFY nombre VARCHAR(255) NOT NULL COMMENT 'Ciudad o localidad de la provincia de Buenos Aires';

UPDATE agentes a
INNER JOIN areas ar ON ar.id = a.idArea AND ar.idInmobiliaria = a.idInmobiliaria
SET a.idArea = NULL
WHERE ar.nombre NOT IN (
  'Avellaneda',
  'Bahía Blanca',
  'La Plata',
  'Lanús',
  'Lomas de Zamora',
  'Mar del Plata',
  'Morón',
  'Pilar',
  'Quilmes',
  'San Isidro',
  'Tandil',
  'Tigre'
);

DELETE FROM areas
WHERE nombre NOT IN (
  'Avellaneda',
  'Bahía Blanca',
  'La Plata',
  'Lanús',
  'Lomas de Zamora',
  'Mar del Plata',
  'Morón',
  'Pilar',
  'Quilmes',
  'San Isidro',
  'Tandil',
  'Tigre'
);

INSERT IGNORE INTO areas (idInmobiliaria, nombre)
SELECT i.id, ciudades.nombre
FROM inmobiliaria i
CROSS JOIN (
  SELECT 'Avellaneda' AS nombre UNION ALL
  SELECT 'Bahía Blanca' UNION ALL
  SELECT 'La Plata' UNION ALL
  SELECT 'Lanús' UNION ALL
  SELECT 'Lomas de Zamora' UNION ALL
  SELECT 'Mar del Plata' UNION ALL
  SELECT 'Morón' UNION ALL
  SELECT 'Pilar' UNION ALL
  SELECT 'Quilmes' UNION ALL
  SELECT 'San Isidro' UNION ALL
  SELECT 'Tandil' UNION ALL
  SELECT 'Tigre'
) ciudades;
