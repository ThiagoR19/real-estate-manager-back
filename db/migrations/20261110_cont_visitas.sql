CREATE TABLE IF NOT EXISTS `contVisitas` (
    `idInmobiliaria` INT NOT NULL,
    `fecha` DATE NOT NULL,
    `cantidad` INT NOT NULL DEFAULT 0,
    PRIMARY KEY (`idInmobiliaria`, `fecha`),
    CONSTRAINT `fk_ContVisitas_inmobiliaria` FOREIGN KEY (`idInmobiliaria`) REFERENCES `inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `ck_ContVisitas_1` CHECK (`cantidad` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
