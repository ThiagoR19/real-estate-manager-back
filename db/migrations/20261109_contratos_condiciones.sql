ALTER TABLE contratos
    ADD COLUMN mesesAumento INT NULL AFTER mesesDeAviso,
    ADD COLUMN tipoAumento ENUM('FIJO','INDEC') NULL AFTER mesesAumento,
    ADD COLUMN valorAumentoFijo DECIMAL(12,2) NULL AFTER tipoAumento,
    ADD COLUMN condiciones TEXT NULL AFTER valorAumentoFijo,
    ADD COLUMN fechaRescision DATE NULL AFTER motivoAnulacion,
    ADD COLUMN motivoRescision VARCHAR(500) NULL AFTER fechaRescision,
    ADD CONSTRAINT `ck_32_5` CHECK (`mesesAumento` IS NULL OR `mesesAumento` > 0),
    ADD CONSTRAINT `ck_32_6` CHECK (`valorAumentoFijo` IS NULL OR `valorAumentoFijo` >= 0),
    ADD CONSTRAINT `ck_32_7` CHECK (`fechaRescision` IS NULL OR `fechaInicio` IS NULL OR `fechaRescision` >= `fechaInicio`);
