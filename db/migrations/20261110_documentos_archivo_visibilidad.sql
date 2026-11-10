ALTER TABLE documentos
    ADD COLUMN visibilidad ENUM('INTERNA','PARTES') NOT NULL DEFAULT 'INTERNA' AFTER tipo,
    ADD COLUMN fechaArchivado DATETIME NULL AFTER fechaCreacion,
    ADD COLUMN motivoArchivo VARCHAR(500) NULL AFTER fechaArchivado,
    ADD CONSTRAINT `ck_48_1` CHECK (`idPropiedad` IS NOT NULL OR `idContrato` IS NOT NULL OR `idPersona` IS NOT NULL OR `idReporte` IS NOT NULL OR `idCobro` IS NOT NULL);
