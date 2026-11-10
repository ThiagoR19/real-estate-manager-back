-- Ejecutar una vez sobre una base existente. Requiere MySQL 8.0.16+.
-- Los pagos existentes toman como periodo el mes de fechaVencimiento.
-- Primero comprobar duplicados sin modificar tablas permanentes: una colisión
-- detiene la migración para que se corrija manualmente antes de reintentar.
DROP TEMPORARY TABLE IF EXISTS `_mig_20261110_periodos`;
CREATE TEMPORARY TABLE `_mig_20261110_periodos` (
    `idInmobiliaria` INT NOT NULL,
    `idContrato` INT NOT NULL,
    `periodo` DATE NOT NULL,
    PRIMARY KEY (`idInmobiliaria`, `idContrato`, `periodo`)
) ENGINE=InnoDB;
INSERT INTO `_mig_20261110_periodos` (`idInmobiliaria`, `idContrato`, `periodo`)
SELECT `idInmobiliaria`, `idContrato`,
       DATE_SUB(DATE(`fechaVencimiento`), INTERVAL (DAYOFMONTH(`fechaVencimiento`) - 1) DAY)
FROM `pagos`;

DROP TEMPORARY TABLE IF EXISTS `_mig_20261110_cobros`;
CREATE TEMPORARY TABLE `_mig_20261110_cobros` (
    `idInmobiliaria` INT NOT NULL,
    `idPago` INT NOT NULL,
    `idPropietario` INT NOT NULL,
    PRIMARY KEY (`idInmobiliaria`, `idPago`, `idPropietario`)
) ENGINE=InnoDB;
INSERT INTO `_mig_20261110_cobros` (`idInmobiliaria`, `idPago`, `idPropietario`)
SELECT `idInmobiliaria`, `idPago`, `idPropietario` FROM `cobros`;

ALTER TABLE `conceptosPago`
    ADD COLUMN `idInmobiliaria` INT NULL AFTER `id`,
    ADD COLUMN `tenantClave` INT GENERATED ALWAYS AS (COALESCE(`idInmobiliaria`, 0)) STORED AFTER `idInmobiliaria`,
    DROP INDEX `uq_ConceptosPago_1`,
    ADD UNIQUE KEY `uq_ConceptosPago_tenant_id` (`id`, `tenantClave`),
    ADD UNIQUE KEY `uq_ConceptosPago_1` (`tenantClave`, `nombre`),
    ADD CONSTRAINT `fk_ConceptosPago_inmobiliaria` FOREIGN KEY (`idInmobiliaria`) REFERENCES `inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT;

-- Los conceptos preexistentes son globales: conceptoTenantClave = 0.
-- Para un concepto propio, la API deberá usar el id de su inmobiliaria.
ALTER TABLE `pagosConceptos`
    ADD COLUMN `conceptoTenantClave` INT NOT NULL DEFAULT 0 AFTER `idConcepto`,
    DROP FOREIGN KEY `fk_068`,
    ADD KEY `idx_PagosConceptos_concepto_tenant` (`idConcepto`, `conceptoTenantClave`),
    ADD CONSTRAINT `fk_068` FOREIGN KEY (`idConcepto`, `conceptoTenantClave`) REFERENCES `conceptosPago` (`id`, `tenantClave`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    ADD CONSTRAINT `ck_PagosConceptos_tenant` CHECK (`conceptoTenantClave` = 0 OR `conceptoTenantClave` = `idInmobiliaria`);

ALTER TABLE `pagos`
    ADD COLUMN `periodo` DATE NULL AFTER `idEstado`,
    ADD COLUMN `medioPago` ENUM('TRANSFERENCIA','EFECTIVO','OTRO') NULL AFTER `monto`,
    ADD COLUMN `fechaAnulacion` DATETIME NULL AFTER `detalle`,
    ADD COLUMN `motivoAnulacion` VARCHAR(255) NULL AFTER `fechaAnulacion`;
UPDATE `pagos`
SET `periodo` = DATE_SUB(DATE(`fechaVencimiento`), INTERVAL (DAYOFMONTH(`fechaVencimiento`) - 1) DAY);
ALTER TABLE `pagos`
    MODIFY COLUMN `periodo` DATE NOT NULL,
    ADD UNIQUE KEY `uq_Pagos_contrato_periodo` (`idInmobiliaria`, `idContrato`, `periodo`),
    ADD CONSTRAINT `ck_Pagos_periodo` CHECK (DAYOFMONTH(`periodo`) = 1);

ALTER TABLE `cobros`
    ADD COLUMN `descuentos` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `comision`,
    ADD COLUMN `detalleDescuentos` VARCHAR(500) NULL AFTER `descuentos`,
    MODIFY COLUMN `montoNeto` DECIMAL(12,2) GENERATED ALWAYS AS (`montoBruto` - `comision` - `descuentos`) STORED,
    ADD UNIQUE KEY `uq_Cobros_pago_propietario` (`idInmobiliaria`, `idPago`, `idPropietario`),
    ADD CONSTRAINT `ck_Cobros_descuentos` CHECK (`descuentos` >= 0 AND `comision` + `descuentos` <= `montoBruto`);

DROP TEMPORARY TABLE `_mig_20261110_periodos`;
DROP TEMPORARY TABLE `_mig_20261110_cobros`;
