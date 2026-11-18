INSERT IGNORE INTO `tiposNotificaciones` (`nombre`) VALUES
    ('Cuenta'), ('Contrato'), ('Mantenimiento'), ('Mensaje'), ('Pago'), ('Visita');

ALTER TABLE `personasNotificaciones`
    DROP FOREIGN KEY `fk_080`,
    ADD CONSTRAINT `fk_personas_notificaciones_persona`
        FOREIGN KEY (`idInmobiliaria`, `idPersona`)
        REFERENCES `personas` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE CASCADE;
