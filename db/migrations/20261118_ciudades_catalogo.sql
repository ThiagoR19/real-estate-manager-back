-- Ejecutar después de 20261112_areas_ciudades_buenos_aires.sql.
-- Conserva areas.id para mantener las asignaciones existentes de agentes.idArea.
CREATE TABLE IF NOT EXISTS `ciudades` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Ciudades_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `ciudades` (`nombre`) VALUES
    ('Avellaneda'),
    ('Bahía Blanca'),
    ('La Plata'),
    ('Lanús'),
    ('Lomas de Zamora'),
    ('Mar del Plata'),
    ('Morón'),
    ('Pilar'),
    ('Quilmes'),
    ('San Isidro'),
    ('Tandil'),
    ('Tigre');

ALTER TABLE `areas`
    ADD COLUMN `idCiudad` INT NULL AFTER `idInmobiliaria`;

UPDATE `areas` a
INNER JOIN `ciudades` c ON c.nombre = TRIM(a.nombre)
SET a.idCiudad = c.id;

-- Si existen areas con nombres fuera del catálogo, el NOT NULL detiene la
-- migración. Revisarlas antes de continuar y volver a ejecutar desde el UPDATE.
ALTER TABLE `areas`
    MODIFY COLUMN `idCiudad` INT NOT NULL,
    DROP INDEX `uq_Areas_1`,
    DROP COLUMN `nombre`,
    ADD UNIQUE KEY `uq_Areas_tenant_ciudad` (`idInmobiliaria`, `idCiudad`),
    ADD CONSTRAINT `fk_Areas_ciudad` FOREIGN KEY (`idCiudad`)
        REFERENCES `ciudades` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT;
