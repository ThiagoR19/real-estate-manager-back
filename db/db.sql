SET NAMES utf8mb4;
CREATE TABLE IF NOT EXISTS `Inmobiliaria` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `Nombre` VARCHAR(255) NOT NULL,
    `Teléfono` VARCHAR(20) NULL,
    `Ubicación` VARCHAR(255) NULL,
    `Dominio` VARCHAR(255) NULL,
    `Imagen_logo` VARCHAR(255) NULL,
    `Fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Inmobiliaria_1` (`Dominio`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Roles` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `Nombre` VARCHAR(80) NOT NULL,
    `Ambito` ENUM('PLATAFORMA', 'INMOBILIARIA') NOT NULL DEFAULT 'INMOBILIARIA',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Roles_1` (`Nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `EstadosComerciales` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `Nombre` VARCHAR(255) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_EstadosComerciales_1` (`Nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Servicios` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `Nombre` VARCHAR(255) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Servicios_1` (`Nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `TiposNotificaciones` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `Nombre` VARCHAR(255) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_TiposNotificaciones_1` (`Nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Estados_visitas` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `Nombre` VARCHAR(255) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Estados_visitas_1` (`Nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Categorías` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `Nombre` VARCHAR(255) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Categorías_1` (`Nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `TiposPropiedades` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `Nombre` VARCHAR(255) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_TiposPropiedades_1` (`Nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `TiposParticipacion` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `Nombre` VARCHAR(255) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_TiposParticipacion_1` (`Nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `EstadosContratos` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `Nombre` VARCHAR(255) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_EstadosContratos_1` (`Nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `TiposContratos` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `Nombre` VARCHAR(255) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_TiposContratos_1` (`Nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Estados_pagos` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `Nombre` VARCHAR(255) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Estados_pagos_1` (`Nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Estados_reportes` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `Nombre` VARCHAR(255) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Estados_reportes_1` (`Nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Estados_cobros` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `Nombre` VARCHAR(255) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Estados_cobros_1` (`Nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ConceptosPago` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `Nombre` VARCHAR(255) NOT NULL,
    `Descripcion` VARCHAR(255) NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_ConceptosPago_1` (`Nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Areas` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_inmobiliaria` INT NOT NULL,
    `Nombre` VARCHAR(255) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Areas_tenant_id` (`id_inmobiliaria`, `id`),
    UNIQUE KEY `uq_Areas_1` (`id_inmobiliaria`, `Nombre`),
    CONSTRAINT `fk_001` FOREIGN KEY (`id_inmobiliaria`) REFERENCES `Inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Personas` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_inmobiliaria` INT NULL,
    `Tenant_clave` INT GENERATED ALWAYS AS (COALESCE(`id_inmobiliaria`, 0)) STORED,
    `Nombre` VARCHAR(255) NOT NULL,
    `Apellido` VARCHAR(255) NOT NULL,
    `Correo` VARCHAR(255) NULL,
    `DNI` VARCHAR(20) NULL,
    `Teléfono` VARCHAR(20) NULL,
    `Dirección` VARCHAR(255) NULL,
    `Fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Personas_tenant_id` (`id_inmobiliaria`, `id`),
    UNIQUE KEY `uq_Personas_id_namespace` (`id`, `Tenant_clave`),
    UNIQUE KEY `uq_Personas_1` (`Tenant_clave`, `DNI`),
    UNIQUE KEY `uq_Personas_2` (`Tenant_clave`, `Correo`),
    KEY `idx_Personas_1` (`Apellido`, `Nombre`),
    CONSTRAINT `fk_002` FOREIGN KEY (`id_inmobiliaria`) REFERENCES `Inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `ck_Personas_id_inmobiliaria_positiva` CHECK (`id_inmobiliaria` IS NULL OR `id_inmobiliaria` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Usuarios` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_inmobiliaria` INT NULL,
    `Tenant_clave` INT GENERATED ALWAYS AS (COALESCE(`id_inmobiliaria`, 0)) STORED,
    `id_persona` INT NOT NULL,
    `id_rol` INT NOT NULL,
    `Usuario` VARCHAR(255) NULL,
    `Password_hash` VARCHAR(255) NULL,
    `Google_sub` VARCHAR(255) NULL,
    `Fecha_activacion` DATETIME NULL,
    `Ultimo_acceso` DATETIME NULL,
    `Fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Usuarios_tenant_id` (`id_inmobiliaria`, `id`),
    UNIQUE KEY `uq_Usuarios_1` (`id_persona`),
    UNIQUE KEY `uq_Usuarios_2` (`Tenant_clave`, `Usuario`),
    UNIQUE KEY `uq_Usuarios_3` (`Tenant_clave`, `Google_sub`),
    KEY `idx_Usuarios_1` (`id_rol`),
    CONSTRAINT `fk_003` FOREIGN KEY (`id_inmobiliaria`) REFERENCES `Inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_004` FOREIGN KEY (`id_persona`) REFERENCES `Personas` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_005` FOREIGN KEY (`id_persona`, `Tenant_clave`) REFERENCES `Personas` (`id`, `Tenant_clave`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_006` FOREIGN KEY (`id_rol`) REFERENCES `Roles` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `ck_Usuarios_id_inmobiliaria_positiva` CHECK (`id_inmobiliaria` IS NULL OR `id_inmobiliaria` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `TokensAcceso` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_usuario` INT NOT NULL,
    `Token_hash` CHAR(64) NOT NULL,
    `Proposito` ENUM('ACTIVACION','RECUPERACION') NOT NULL,
    `Fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `Fecha_expiracion` DATETIME NOT NULL,
    `Fecha_uso` DATETIME NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_TokensAcceso_1` (`Token_hash`),
    KEY `idx_TokensAcceso_1` (`id_usuario`, `Proposito`, `Fecha_expiracion`),
    CONSTRAINT `fk_007` FOREIGN KEY (`id_usuario`) REFERENCES `Usuarios` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `ck_19_1` CHECK (`Fecha_expiracion` > `Fecha_creacion`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Agentes` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_inmobiliaria` INT NOT NULL,
    `id_persona` INT NOT NULL,
    `id_area` INT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Agentes_tenant_id` (`id_inmobiliaria`, `id`),
    UNIQUE KEY `uq_Agentes_1` (`id_persona`),
    CONSTRAINT `fk_008` FOREIGN KEY (`id_inmobiliaria`) REFERENCES `Inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_009` FOREIGN KEY (`id_inmobiliaria`, `id_persona`) REFERENCES `Personas` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_010` FOREIGN KEY (`id_inmobiliaria`, `id_area`) REFERENCES `Areas` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Propietarios` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_inmobiliaria` INT NOT NULL,
    `id_persona` INT NOT NULL,
    `CBU` VARCHAR(22) NULL,
    `Alias` VARCHAR(255) NULL,
    `Activo` BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Propietarios_tenant_id` (`id_inmobiliaria`, `id`),
    UNIQUE KEY `uq_Propietarios_1` (`id_persona`),
    CONSTRAINT `fk_011` FOREIGN KEY (`id_inmobiliaria`) REFERENCES `Inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_012` FOREIGN KEY (`id_inmobiliaria`, `id_persona`) REFERENCES `Personas` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Inquilinos` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_inmobiliaria` INT NOT NULL,
    `id_persona` INT NOT NULL,
    `Activo` BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Inquilinos_tenant_id` (`id_inmobiliaria`, `id`),
    UNIQUE KEY `uq_Inquilinos_persona` (`id_persona`),
    CONSTRAINT `fk_Inquilinos_inmobiliaria` FOREIGN KEY (`id_inmobiliaria`) REFERENCES `Inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_Inquilinos_persona` FOREIGN KEY (`id_inmobiliaria`, `id_persona`) REFERENCES `Personas` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Profesionales` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_inmobiliaria` INT NOT NULL,
    `id_persona` INT NOT NULL,
    `Profesion` VARCHAR(255) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Profesionales_tenant_id` (`id_inmobiliaria`, `id`),
    UNIQUE KEY `uq_Profesionales_1` (`id_persona`),
    CONSTRAINT `fk_015` FOREIGN KEY (`id_inmobiliaria`) REFERENCES `Inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_016` FOREIGN KEY (`id_inmobiliaria`, `id_persona`) REFERENCES `Personas` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Propiedades` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_inmobiliaria` INT NOT NULL,
    `id_estadoComercial` INT NOT NULL,
    `id_tipo` INT NOT NULL,
    `id_agente` INT NULL,
    `Nombre` VARCHAR(255) NOT NULL,
    `Descripción` TEXT NULL,
    `Ubicación` VARCHAR(255) NULL,
    `Precio` DECIMAL(12,2) NULL,
    `Moneda` CHAR(3) NOT NULL DEFAULT 'ARS',
    `Publicada` BOOLEAN NOT NULL DEFAULT FALSE,
    `Tamaño` DECIMAL(10,2) NULL,
    `Antigüedad` INT NULL,
    `Baños` INT NULL,
    `Habitaciones` INT NULL,
    `Fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Propiedades_tenant_id` (`id_inmobiliaria`, `id`),
    KEY `idx_Propiedades_1` (`id_inmobiliaria`, `Publicada`),
    CONSTRAINT `fk_017` FOREIGN KEY (`id_inmobiliaria`) REFERENCES `Inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_018` FOREIGN KEY (`id_estadoComercial`) REFERENCES `EstadosComerciales` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_019` FOREIGN KEY (`id_tipo`) REFERENCES `TiposPropiedades` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_020` FOREIGN KEY (`id_inmobiliaria`, `id_agente`) REFERENCES `Agentes` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `ck_24_1` CHECK (`Moneda` IN ('ARS','USD')),
    CONSTRAINT `ck_24_2` CHECK (`Precio` IS NULL OR `Precio` >= 0),
    CONSTRAINT `ck_24_3` CHECK (`Tamaño` IS NULL OR `Tamaño` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Clientes` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_inmobiliaria` INT NOT NULL,
    `id_persona` INT NOT NULL,
    `Interes` ENUM('COMPRA','ALQUILER','AMBOS') NOT NULL,
    `id_propiedad_interes` INT NULL,
    `Estado_seguimiento` VARCHAR(80) NOT NULL DEFAULT 'NUEVO',
    `Observaciones` TEXT NULL,
    `Fecha_contacto` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Clientes_tenant_id` (`id_inmobiliaria`, `id`),
    UNIQUE KEY `uq_Clientes_1` (`id_persona`),
    CONSTRAINT `fk_013` FOREIGN KEY (`id_inmobiliaria`) REFERENCES `Inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_014` FOREIGN KEY (`id_inmobiliaria`, `id_persona`) REFERENCES `Personas` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_clientes_propiedad_interes` FOREIGN KEY (`id_inmobiliaria`, `id_propiedad_interes`) REFERENCES `Propiedades` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `propiedades_personas` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_inmobiliaria` INT NOT NULL,
    `id_propiedad` INT NOT NULL,
    `id_persona` INT NOT NULL,
    `id_tipoParticipacion` INT NOT NULL,
    `Porcentaje_titularidad` DECIMAL(7,4) NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_propiedades_personas_tenant_id` (`id_inmobiliaria`, `id`),
    UNIQUE KEY `uq_propiedades_personas_1` (`id_propiedad`, `id_persona`, `id_tipoParticipacion`),
    CONSTRAINT `fk_021` FOREIGN KEY (`id_inmobiliaria`) REFERENCES `Inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_022` FOREIGN KEY (`id_inmobiliaria`, `id_propiedad`) REFERENCES `Propiedades` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_023` FOREIGN KEY (`id_inmobiliaria`, `id_persona`) REFERENCES `Personas` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_024` FOREIGN KEY (`id_tipoParticipacion`) REFERENCES `TiposParticipacion` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `ck_25_1` CHECK (`Porcentaje_titularidad` IS NULL OR (`Porcentaje_titularidad` >= 0 AND `Porcentaje_titularidad` <= 100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `propiedades_imagenes` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_inmobiliaria` INT NOT NULL,
    `id_propiedad` INT NOT NULL,
    `Nombre` VARCHAR(255) NOT NULL,
    `Orden` INT NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_propiedades_imagenes_tenant_id` (`id_inmobiliaria`, `id`),
    CONSTRAINT `fk_025` FOREIGN KEY (`id_inmobiliaria`) REFERENCES `Inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_026` FOREIGN KEY (`id_inmobiliaria`, `id_propiedad`) REFERENCES `Propiedades` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `propiedades_servicios` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_inmobiliaria` INT NOT NULL,
    `id_propiedad` INT NOT NULL,
    `id_servicio` INT NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_propiedades_servicios_tenant_id` (`id_inmobiliaria`, `id`),
    UNIQUE KEY `uq_propiedades_servicios_1` (`id_propiedad`, `id_servicio`),
    CONSTRAINT `fk_027` FOREIGN KEY (`id_inmobiliaria`) REFERENCES `Inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_028` FOREIGN KEY (`id_inmobiliaria`, `id_propiedad`) REFERENCES `Propiedades` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_029` FOREIGN KEY (`id_servicio`) REFERENCES `Servicios` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Visitas` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_inmobiliaria` INT NOT NULL,
    `id_persona` INT NOT NULL,
    `id_propiedad` INT NOT NULL,
    `id_agente` INT NOT NULL,
    `id_estado` INT NOT NULL,
    `Fecha` DATETIME NOT NULL,
    `Motivo_cancelacion` VARCHAR(500) NULL,
    `Fecha_cancelacion` DATETIME NULL,
    `Fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Visitas_tenant_id` (`id_inmobiliaria`, `id`),
    KEY `idx_Visitas_1` (`id_inmobiliaria`, `Fecha`),
    CONSTRAINT `fk_030` FOREIGN KEY (`id_inmobiliaria`) REFERENCES `Inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_031` FOREIGN KEY (`id_inmobiliaria`, `id_persona`) REFERENCES `Personas` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_032` FOREIGN KEY (`id_inmobiliaria`, `id_propiedad`) REFERENCES `Propiedades` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_033` FOREIGN KEY (`id_inmobiliaria`, `id_agente`) REFERENCES `Agentes` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_034` FOREIGN KEY (`id_estado`) REFERENCES `Estados_visitas` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Reportes` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_inmobiliaria` INT NOT NULL,
    `id_propiedad` INT NOT NULL,
    `id_categoria` INT NOT NULL,
    `id_estado` INT NOT NULL,
    `id_persona_reporta` INT NOT NULL,
    `id_profesional` INT NULL,
    `Prioridad` ENUM('BAJA','MEDIA','ALTA','URGENTE') NOT NULL DEFAULT 'MEDIA',
    `Título` VARCHAR(255) NOT NULL,
    `Descripción` TEXT NULL,
    `Fecha` DATE NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Reportes_tenant_id` (`id_inmobiliaria`, `id`),
    KEY `idx_Reportes_1` (`id_inmobiliaria`, `Prioridad`, `id_estado`),
    CONSTRAINT `fk_035` FOREIGN KEY (`id_inmobiliaria`) REFERENCES `Inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_036` FOREIGN KEY (`id_inmobiliaria`, `id_propiedad`) REFERENCES `Propiedades` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_037` FOREIGN KEY (`id_categoria`) REFERENCES `Categorías` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_038` FOREIGN KEY (`id_estado`) REFERENCES `Estados_reportes` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_039` FOREIGN KEY (`id_inmobiliaria`, `id_persona_reporta`) REFERENCES `Personas` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_040` FOREIGN KEY (`id_inmobiliaria`, `id_profesional`) REFERENCES `Profesionales` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `reportes_imagenes` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_inmobiliaria` INT NOT NULL,
    `id_reporte` INT NOT NULL,
    `Nombre` VARCHAR(255) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_reportes_imagenes_tenant_id` (`id_inmobiliaria`, `id`),
    CONSTRAINT `fk_041` FOREIGN KEY (`id_inmobiliaria`) REFERENCES `Inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_042` FOREIGN KEY (`id_inmobiliaria`, `id_reporte`) REFERENCES `Reportes` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ValoracionesProfesionales` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_inmobiliaria` INT NOT NULL,
    `id_profesional` INT NOT NULL,
    `id_persona_autora` INT NOT NULL,
    `id_reporte` INT NULL,
    `Puntuacion` TINYINT NOT NULL,
    `Comentario` TEXT NULL,
    `Fecha` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_ValoracionesProfesionales_tenant_id` (`id_inmobiliaria`, `id`),
    UNIQUE KEY `uq_ValoracionesProfesionales_1` (`id_reporte`, `id_persona_autora`),
    CONSTRAINT `fk_043` FOREIGN KEY (`id_inmobiliaria`) REFERENCES `Inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_044` FOREIGN KEY (`id_inmobiliaria`, `id_profesional`) REFERENCES `Profesionales` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_045` FOREIGN KEY (`id_inmobiliaria`, `id_persona_autora`) REFERENCES `Personas` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_046` FOREIGN KEY (`id_inmobiliaria`, `id_reporte`) REFERENCES `Reportes` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `ck_31_1` CHECK (`Puntuacion` BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Contratos` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_inmobiliaria` INT NOT NULL,
    `id_tipoContrato` INT NOT NULL,
    `id_estadoContrato` INT NOT NULL,
    `id_propiedad` INT NOT NULL,
    `id_contrato_anterior` INT NULL,
    `Fecha_firma` DATE NULL,
    `Fecha_inicio` DATE NULL,
    `Fecha_fin` DATE NULL,
    `Meses_de_aviso` INT NOT NULL DEFAULT 0,
    `Monto_acordado` DECIMAL(12,2) NOT NULL,
    `Moneda` CHAR(3) NOT NULL DEFAULT 'ARS',
    `Periodicidad_pago` ENUM('UNICO','MENSUAL') NOT NULL,
    `Fecha_anulacion` DATETIME NULL,
    `Motivo_anulacion` VARCHAR(255) NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Contratos_tenant_id` (`id_inmobiliaria`, `id`),
    UNIQUE KEY `uq_Contratos_1` (`id_inmobiliaria`, `id_propiedad`, `id`),
    CONSTRAINT `fk_047` FOREIGN KEY (`id_inmobiliaria`) REFERENCES `Inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_048` FOREIGN KEY (`id_tipoContrato`) REFERENCES `TiposContratos` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_049` FOREIGN KEY (`id_estadoContrato`) REFERENCES `EstadosContratos` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_050` FOREIGN KEY (`id_inmobiliaria`, `id_propiedad`) REFERENCES `Propiedades` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_051` FOREIGN KEY (`id_inmobiliaria`, `id_propiedad`, `id_contrato_anterior`) REFERENCES `Contratos` (`id_inmobiliaria`, `id_propiedad`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `ck_32_1` CHECK (`Moneda` IN ('ARS','USD')),
    CONSTRAINT `ck_32_2` CHECK (`Meses_de_aviso` >= 0),
    CONSTRAINT `ck_32_3` CHECK (`Monto_acordado` >= 0),
    CONSTRAINT `ck_32_4` CHECK (`Fecha_fin` IS NULL OR `Fecha_inicio` IS NULL OR `Fecha_fin` >= `Fecha_inicio`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `contratos_personas` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_inmobiliaria` INT NOT NULL,
    `id_contrato` INT NOT NULL,
    `id_persona` INT NOT NULL,
    `id_tipoParticipacion` INT NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_contratos_personas_tenant_id` (`id_inmobiliaria`, `id`),
    UNIQUE KEY `uq_contratos_personas_1` (`id_contrato`, `id_persona`, `id_tipoParticipacion`),
    CONSTRAINT `fk_052` FOREIGN KEY (`id_inmobiliaria`) REFERENCES `Inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_053` FOREIGN KEY (`id_inmobiliaria`, `id_contrato`) REFERENCES `Contratos` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_054` FOREIGN KEY (`id_inmobiliaria`, `id_persona`) REFERENCES `Personas` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_055` FOREIGN KEY (`id_tipoParticipacion`) REFERENCES `TiposParticipacion` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Indec` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_inmobiliaria` INT NOT NULL,
    `Año` SMALLINT NOT NULL,
    `Mes` TINYINT NOT NULL,
    `Valor` DECIMAL(9,4) NOT NULL,
    `Fecha_registro` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Indec_tenant_id` (`id_inmobiliaria`, `id`),
    UNIQUE KEY `uq_Indec_1` (`id_inmobiliaria`, `Año`, `Mes`),
    CONSTRAINT `fk_056` FOREIGN KEY (`id_inmobiliaria`) REFERENCES `Inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `ck_34_1` CHECK (`Mes` BETWEEN 1 AND 12)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `AjustesAlquiler` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_inmobiliaria` INT NOT NULL,
    `id_contrato` INT NOT NULL,
    `Fecha_aplicacion` DATE NOT NULL,
    `Monto_anterior` DECIMAL(12,2) NOT NULL,
    `Porcentaje_aplicado` DECIMAL(9,4) NOT NULL,
    `Monto_nuevo` DECIMAL(12,2) NOT NULL,
    `Observaciones` VARCHAR(500) NULL,
    `Fecha_registro` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_AjustesAlquiler_tenant_id` (`id_inmobiliaria`, `id`),
    UNIQUE KEY `uq_AjustesAlquiler_1` (`id_contrato`, `Fecha_aplicacion`),
    CONSTRAINT `fk_057` FOREIGN KEY (`id_inmobiliaria`) REFERENCES `Inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_058` FOREIGN KEY (`id_inmobiliaria`, `id_contrato`) REFERENCES `Contratos` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `ck_35_1` CHECK (`Monto_anterior` >= 0),
    CONSTRAINT `ck_35_2` CHECK (`Monto_nuevo` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ajustes_indec` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_inmobiliaria` INT NOT NULL,
    `id_ajuste` INT NOT NULL,
    `id_indec` INT NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_ajustes_indec_tenant_id` (`id_inmobiliaria`, `id`),
    UNIQUE KEY `uq_ajustes_indec_1` (`id_ajuste`, `id_indec`),
    CONSTRAINT `fk_059` FOREIGN KEY (`id_inmobiliaria`) REFERENCES `Inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_060` FOREIGN KEY (`id_inmobiliaria`, `id_ajuste`) REFERENCES `AjustesAlquiler` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_061` FOREIGN KEY (`id_inmobiliaria`, `id_indec`) REFERENCES `Indec` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Pagos` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_inmobiliaria` INT NOT NULL,
    `id_contrato` INT NOT NULL,
    `id_persona` INT NOT NULL,
    `id_estado` INT NOT NULL,
    `Monto` DECIMAL(12,2) NOT NULL,
    `Fecha_vencimiento` DATETIME NOT NULL,
    `Fecha_pago` DATE NULL,
    `Fecha_registro` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `Detalle` VARCHAR(255) NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Pagos_tenant_id` (`id_inmobiliaria`, `id`),
    KEY `idx_Pagos_1` (`id_inmobiliaria`, `Fecha_vencimiento`),
    CONSTRAINT `fk_062` FOREIGN KEY (`id_inmobiliaria`) REFERENCES `Inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_063` FOREIGN KEY (`id_inmobiliaria`, `id_contrato`) REFERENCES `Contratos` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_064` FOREIGN KEY (`id_inmobiliaria`, `id_persona`) REFERENCES `Personas` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_065` FOREIGN KEY (`id_estado`) REFERENCES `Estados_pagos` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `ck_37_1` CHECK (`Monto` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pagos_conceptos` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_inmobiliaria` INT NOT NULL,
    `id_concepto` INT NOT NULL,
    `id_pago` INT NOT NULL,
    `Monto` DECIMAL(12,2) NOT NULL,
    `Detalle` VARCHAR(255) NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_pagos_conceptos_tenant_id` (`id_inmobiliaria`, `id`),
    UNIQUE KEY `uq_pagos_conceptos_1` (`id_concepto`, `id_pago`),
    CONSTRAINT `fk_066` FOREIGN KEY (`id_inmobiliaria`) REFERENCES `Inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_067` FOREIGN KEY (`id_inmobiliaria`, `id_pago`) REFERENCES `Pagos` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_068` FOREIGN KEY (`id_concepto`) REFERENCES `ConceptosPago` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `ck_38_1` CHECK (`Monto` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Comprobantes` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_inmobiliaria` INT NOT NULL,
    `id_pago` INT NOT NULL,
    `id_persona_carga` INT NOT NULL,
    `id_persona_revisora` INT NULL,
    `Nombre_archivo` VARCHAR(255) NOT NULL,
    `Ruta_archivo` VARCHAR(1024) NOT NULL,
    `Estado` ENUM('PENDIENTE','APROBADO','RECHAZADO') NOT NULL DEFAULT 'PENDIENTE',
    `id_pago_aprobado` INT GENERATED ALWAYS AS (CASE WHEN `Estado` = 'APROBADO' THEN `id_pago` ELSE NULL END) STORED,
    `Motivo_rechazo` VARCHAR(500) NULL,
    `Fecha_carga` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `Fecha_revision` DATETIME NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Comprobantes_tenant_id` (`id_inmobiliaria`, `id`),
    KEY `idx_Comprobantes_1` (`id_pago`, `Fecha_carga`),
    UNIQUE KEY `uq_Comprobantes_aprobado` (`id_pago_aprobado`),
    CONSTRAINT `fk_069` FOREIGN KEY (`id_inmobiliaria`) REFERENCES `Inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_070` FOREIGN KEY (`id_inmobiliaria`, `id_pago`) REFERENCES `Pagos` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_071` FOREIGN KEY (`id_inmobiliaria`, `id_persona_carga`) REFERENCES `Personas` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_072` FOREIGN KEY (`id_inmobiliaria`, `id_persona_revisora`) REFERENCES `Personas` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Cobros` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_inmobiliaria` INT NOT NULL,
    `id_pago` INT NOT NULL,
    `id_propietario` INT NOT NULL,
    `id_estado` INT NOT NULL,
    `Monto_bruto` DECIMAL(12,2) NOT NULL,
    `Comision` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    `Porcentaje_comision` DECIMAL(7,4) NULL,
    `Monto_neto` DECIMAL(12,2) GENERATED ALWAYS AS (`Monto_bruto` - `Comision`) STORED,
    `Fecha_generacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `Fecha_cobro` DATETIME NULL,
    `Detalle` VARCHAR(255) NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Cobros_tenant_id` (`id_inmobiliaria`, `id`),
    KEY `idx_Cobros_1` (`id_inmobiliaria`, `id_propietario`, `id_estado`),
    CONSTRAINT `fk_073` FOREIGN KEY (`id_inmobiliaria`) REFERENCES `Inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_074` FOREIGN KEY (`id_inmobiliaria`, `id_pago`) REFERENCES `Pagos` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_075` FOREIGN KEY (`id_inmobiliaria`, `id_propietario`) REFERENCES `Propietarios` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_076` FOREIGN KEY (`id_estado`) REFERENCES `Estados_cobros` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `ck_40_1` CHECK (`Monto_bruto` >= 0),
    CONSTRAINT `ck_40_2` CHECK (`Comision` >= 0 AND `Comision` <= `Monto_bruto`),
    CONSTRAINT `ck_40_3` CHECK (`Porcentaje_comision` IS NULL OR (`Porcentaje_comision` >= 0 AND `Porcentaje_comision` <= 100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Notificaciones` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_inmobiliaria` INT NOT NULL,
    `id_tipo` INT NOT NULL,
    `Titulo` VARCHAR(255) NOT NULL,
    `Contenido` TEXT NOT NULL,
    `Fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Notificaciones_tenant_id` (`id_inmobiliaria`, `id`),
    CONSTRAINT `fk_077` FOREIGN KEY (`id_inmobiliaria`) REFERENCES `Inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_078` FOREIGN KEY (`id_tipo`) REFERENCES `TiposNotificaciones` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `personas_notificaciones` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_inmobiliaria` INT NOT NULL,
    `id_persona` INT NOT NULL,
    `id_notificacion` INT NOT NULL,
    `Leída` BOOLEAN NOT NULL DEFAULT FALSE,
    `Fecha_lectura` DATETIME NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_personas_notificaciones_tenant_id` (`id_inmobiliaria`, `id`),
    UNIQUE KEY `uq_personas_notificaciones_1` (`id_persona`, `id_notificacion`),
    CONSTRAINT `fk_079` FOREIGN KEY (`id_inmobiliaria`) REFERENCES `Inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_080` FOREIGN KEY (`id_inmobiliaria`, `id_persona`) REFERENCES `Personas` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_081` FOREIGN KEY (`id_inmobiliaria`, `id_notificacion`) REFERENCES `Notificaciones` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Conversaciones` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_inmobiliaria` INT NOT NULL,
    `id_persona1` INT NOT NULL,
    `id_persona2` INT NOT NULL,
    `Fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Conversaciones_tenant_id` (`id_inmobiliaria`, `id`),
    UNIQUE KEY `uq_Conversaciones_1` (`id_inmobiliaria`, `id_persona1`, `id_persona2`),
    CONSTRAINT `fk_082` FOREIGN KEY (`id_inmobiliaria`) REFERENCES `Inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_083` FOREIGN KEY (`id_inmobiliaria`, `id_persona1`) REFERENCES `Personas` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_084` FOREIGN KEY (`id_inmobiliaria`, `id_persona2`) REFERENCES `Personas` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `ck_43_1` CHECK (`id_persona1` <> `id_persona2`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `conversaciones_estado` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_inmobiliaria` INT NOT NULL,
    `id_conversacion` INT NOT NULL,
    `id_persona` INT NOT NULL,
    `Fecha_ultima_lectura` DATETIME NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_conversaciones_estado_tenant_id` (`id_inmobiliaria`, `id`),
    UNIQUE KEY `uq_conversaciones_estado_1` (`id_conversacion`, `id_persona`),
    CONSTRAINT `fk_085` FOREIGN KEY (`id_inmobiliaria`) REFERENCES `Inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_086` FOREIGN KEY (`id_inmobiliaria`, `id_conversacion`) REFERENCES `Conversaciones` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_087` FOREIGN KEY (`id_inmobiliaria`, `id_persona`) REFERENCES `Personas` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Mensajes` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_inmobiliaria` INT NOT NULL,
    `id_persona` INT NOT NULL,
    `id_conversacion` INT NOT NULL,
    `Fecha` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `Contenido` TEXT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Mensajes_tenant_id` (`id_inmobiliaria`, `id`),
    KEY `idx_Mensajes_1` (`id_conversacion`, `Fecha`),
    CONSTRAINT `fk_088` FOREIGN KEY (`id_inmobiliaria`) REFERENCES `Inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_089` FOREIGN KEY (`id_inmobiliaria`, `id_persona`) REFERENCES `Personas` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_090` FOREIGN KEY (`id_inmobiliaria`, `id_conversacion`) REFERENCES `Conversaciones` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `mensajes_adjuntos` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_inmobiliaria` INT NOT NULL,
    `id_mensaje` INT NOT NULL,
    `Nombre_archivo` VARCHAR(255) NOT NULL,
    `Ruta_archivo` VARCHAR(1024) NOT NULL,
    `Mime_type` VARCHAR(150) NULL,
    `Tamanio_bytes` BIGINT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_mensajes_adjuntos_tenant_id` (`id_inmobiliaria`, `id`),
    CONSTRAINT `fk_091` FOREIGN KEY (`id_inmobiliaria`) REFERENCES `Inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_092` FOREIGN KEY (`id_inmobiliaria`, `id_mensaje`) REFERENCES `Mensajes` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `ck_46_1` CHECK (`Tamanio_bytes` IS NULL OR `Tamanio_bytes` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Tareas` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_inmobiliaria` INT NOT NULL,
    `id_agente` INT NOT NULL,
    `id_usuario_asignador` INT NOT NULL,
    `Titulo` VARCHAR(255) NOT NULL,
    `Descripcion` TEXT NULL,
    `Prioridad` ENUM('BAJA','MEDIA','ALTA','URGENTE') NOT NULL DEFAULT 'MEDIA',
    `Estado` ENUM('PENDIENTE','EN_PROCESO','COMPLETADA','CANCELADA') NOT NULL DEFAULT 'PENDIENTE',
    `Fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `Fecha_limite` DATETIME NULL,
    `Fecha_finalizacion` DATETIME NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Tareas_tenant_id` (`id_inmobiliaria`, `id`),
    KEY `idx_Tareas_1` (`id_agente`, `Estado`, `Fecha_limite`),
    CONSTRAINT `fk_093` FOREIGN KEY (`id_inmobiliaria`) REFERENCES `Inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_094` FOREIGN KEY (`id_inmobiliaria`, `id_agente`) REFERENCES `Agentes` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_095` FOREIGN KEY (`id_inmobiliaria`, `id_usuario_asignador`) REFERENCES `Usuarios` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Documentos` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_inmobiliaria` INT NOT NULL,
    `id_propiedad` INT NULL,
    `id_contrato` INT NULL,
    `id_persona` INT NULL,
    `id_reporte` INT NULL,
    `id_cobro` INT NULL,
    `Titulo` VARCHAR(255) NOT NULL,
    `Tipo` VARCHAR(100) NULL,
    `Fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Documentos_tenant_id` (`id_inmobiliaria`, `id`),
    CONSTRAINT `fk_096` FOREIGN KEY (`id_inmobiliaria`) REFERENCES `Inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_097` FOREIGN KEY (`id_inmobiliaria`, `id_propiedad`) REFERENCES `Propiedades` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_098` FOREIGN KEY (`id_inmobiliaria`, `id_contrato`) REFERENCES `Contratos` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_099` FOREIGN KEY (`id_inmobiliaria`, `id_persona`) REFERENCES `Personas` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_100` FOREIGN KEY (`id_inmobiliaria`, `id_reporte`) REFERENCES `Reportes` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_101` FOREIGN KEY (`id_inmobiliaria`, `id_cobro`) REFERENCES `Cobros` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `VersionesDocumentos` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_inmobiliaria` INT NOT NULL,
    `id_documento` INT NOT NULL,
    `Numero_version` INT NOT NULL,
    `Nombre_archivo` VARCHAR(255) NOT NULL,
    `Ruta_archivo` VARCHAR(1024) NOT NULL,
    `Mime_type` VARCHAR(150) NULL,
    `Tamanio_bytes` BIGINT NULL,
    `id_usuario_autor` INT NOT NULL,
    `Fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `Comentario` VARCHAR(500) NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_VersionesDocumentos_tenant_id` (`id_inmobiliaria`, `id`),
    UNIQUE KEY `uq_VersionesDocumentos_1` (`id_documento`, `Numero_version`),
    CONSTRAINT `fk_102` FOREIGN KEY (`id_inmobiliaria`) REFERENCES `Inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_103` FOREIGN KEY (`id_inmobiliaria`, `id_documento`) REFERENCES `Documentos` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_104` FOREIGN KEY (`id_inmobiliaria`, `id_usuario_autor`) REFERENCES `Usuarios` (`id_inmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `ck_49_1` CHECK (`Numero_version` > 0),
    CONSTRAINT `ck_49_2` CHECK (`Tamanio_bytes` IS NULL OR `Tamanio_bytes` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Auditoria` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `id_inmobiliaria` INT NULL,
    `id_usuario` INT NULL,
    `Accion` VARCHAR(100) NOT NULL,
    `Entidad` VARCHAR(120) NOT NULL,
    `id_registro` INT NULL,
    `Fecha` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `Ip_origen` VARCHAR(45) NULL,
    `Datos_antes` JSON NULL,
    `Datos_despues` JSON NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Auditoria_tenant_id` (`id_inmobiliaria`, `id`),
    KEY `idx_Auditoria_1` (`id_inmobiliaria`, `Fecha`),
    KEY `idx_Auditoria_2` (`Entidad`, `id_registro`),
    CONSTRAINT `fk_105` FOREIGN KEY (`id_inmobiliaria`) REFERENCES `Inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_106` FOREIGN KEY (`id_usuario`) REFERENCES `Usuarios` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `Roles` (`Nombre`, `Ambito`) VALUES
    ('Superadministrador', 'PLATAFORMA'),
    ('Administrador', 'INMOBILIARIA'),
    ('Agente inmobiliario', 'INMOBILIARIA'),
    ('Propietario', 'INMOBILIARIA'),
    ('Inquilino', 'INMOBILIARIA')
ON DUPLICATE KEY UPDATE `Ambito` = VALUES(`Ambito`);

INSERT IGNORE INTO `TiposContratos` (`Nombre`) VALUES ('Alquiler'), ('Venta');
INSERT IGNORE INTO `TiposParticipacion` (`Nombre`) VALUES
    ('Propietario'), ('Inquilino'), ('Comprador'), ('Vendedor'), ('Garante');

INSERT IGNORE INTO `EstadosComerciales` (`Nombre`) VALUES
    ('Disponible'), ('Reservada'), ('Alquilada'), ('Vendida'), ('Inactiva');
INSERT IGNORE INTO `Estados_visitas` (`Nombre`) VALUES
    ('Programada'), ('Realizada'), ('Cancelada');
INSERT IGNORE INTO `EstadosContratos` (`Nombre`) VALUES
    ('Borrador'), ('Vigente'), ('Finalizado'), ('Rescindido'), ('Anulado');
INSERT IGNORE INTO `Estados_pagos` (`Nombre`) VALUES
    ('Pendiente'), ('En revision'), ('Aprobado'), ('Rechazado'), ('Anulado');
INSERT IGNORE INTO `Estados_reportes` (`Nombre`) VALUES
    ('Abierto'), ('En proceso'), ('Resuelto');
INSERT IGNORE INTO `Estados_cobros` (`Nombre`) VALUES
    ('Pendiente'), ('Liquidado'), ('Anulado');
