

ALTER TABLE `cobros`
    ADD COLUMN `nombreArchivo` VARCHAR(255) NULL AFTER `detalle`,
    ADD COLUMN `rutaArchivo` VARCHAR(1024) NULL AFTER `nombreArchivo`,
    ADD COLUMN `fechaComprobante` DATETIME NULL AFTER `rutaArchivo`;


CREATE TABLE IF NOT EXISTS `cobrosConceptos` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `idInmobiliaria` INT NOT NULL,
    `idCobro` INT NOT NULL,
    `idConcepto` INT NOT NULL,
    `conceptoTenantClave` INT NOT NULL DEFAULT 0,
    `monto` DECIMAL(12,2) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_CobrosConceptos_tenant_id` (`idInmobiliaria`, `id`),
    UNIQUE KEY `uq_CobrosConceptos_1` (`idCobro`, `idConcepto`),
    KEY `idx_CobrosConceptos_concepto_tenant` (`idConcepto`, `conceptoTenantClave`),
    CONSTRAINT `fk_CobrosConceptos_inmobiliaria` FOREIGN KEY (`idInmobiliaria`) REFERENCES `inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_CobrosConceptos_cobro` FOREIGN KEY (`idInmobiliaria`, `idCobro`) REFERENCES `cobros` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_CobrosConceptos_concepto` FOREIGN KEY (`idConcepto`, `conceptoTenantClave`) REFERENCES `conceptosPago` (`id`, `tenantClave`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `ck_CobrosConceptos_tenant` CHECK (`conceptoTenantClave` = 0 OR `conceptoTenantClave` = `idInmobiliaria`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
