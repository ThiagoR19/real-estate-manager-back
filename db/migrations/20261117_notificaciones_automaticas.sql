CREATE TABLE IF NOT EXISTS `superadminsNotificaciones` (
    `idNotificacion` INT NOT NULL,
    `idUsuario` INT NOT NULL,
    `leida` BOOLEAN NOT NULL DEFAULT FALSE,
    `fechaLectura` DATETIME NULL,
    PRIMARY KEY (`idUsuario`, `idNotificacion`),
    CONSTRAINT `fk_superadmins_notificaciones_usuario` FOREIGN KEY (`idUsuario`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_superadmins_notificaciones_notificacion` FOREIGN KEY (`idNotificacion`) REFERENCES `notificaciones` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `tiposNotificaciones` (`nombre`) VALUES
    ('Cuenta'), ('Contrato'), ('Mantenimiento'), ('Mensaje'), ('Pago'), ('Visita');

ALTER TABLE `personasNotificaciones`
    DROP FOREIGN KEY `fk_080`,
    ADD CONSTRAINT `fk_personas_notificaciones_persona`
        FOREIGN KEY (`idInmobiliaria`, `idPersona`)
        REFERENCES `personas` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE CASCADE;
