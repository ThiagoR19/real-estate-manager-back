-- Ejecutar una vez en instalaciones existentes antes de usar las valoraciones.
CREATE TABLE IF NOT EXISTS `votosProfesionales` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `idInmobiliaria` INT NOT NULL,
    `idProfesional` INT NOT NULL,
    `idUsuarioAgente` INT NOT NULL,
    `puntuacion` TINYINT NOT NULL,
    `fecha` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_votos_profesionales_agente` (`idInmobiliaria`, `idProfesional`, `idUsuarioAgente`),
    KEY `idx_votos_profesionales_usuario` (`idInmobiliaria`, `idUsuarioAgente`),
    CONSTRAINT `fk_votos_profesionales_profesional` FOREIGN KEY (`idInmobiliaria`, `idProfesional`) REFERENCES `profesionales` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT `fk_votos_profesionales_usuario` FOREIGN KEY (`idInmobiliaria`, `idUsuarioAgente`) REFERENCES `usuarios` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT `ck_votos_profesionales_puntuacion` CHECK (`puntuacion` BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
