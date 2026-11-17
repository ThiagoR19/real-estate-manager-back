ALTER TABLE `inquilinos`
    ADD COLUMN `idPropiedad` INT NULL AFTER `activo`,
    ADD CONSTRAINT `fk_Inquilinos_propiedad` FOREIGN KEY (`idInmobiliaria`, `idPropiedad`)
    REFERENCES `propiedades` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT;
