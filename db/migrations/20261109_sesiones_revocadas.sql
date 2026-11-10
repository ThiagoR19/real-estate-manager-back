CREATE TABLE IF NOT EXISTS `sesionesRevocadas` (
    `tokenHash` CHAR(64) NOT NULL,
    `idUsuario` INT NOT NULL,
    `fechaExpiracion` DATETIME NOT NULL,
    `fechaRevocacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`tokenHash`),
    KEY `idx_SesionesRevocadas_1` (`fechaExpiracion`),
    CONSTRAINT `fk_SesionesRevocadas_usuario` FOREIGN KEY (`idUsuario`) REFERENCES `usuarios` (`id`) ON UPDATE RESTRICT ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
