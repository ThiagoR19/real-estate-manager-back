SET NAMES utf8mb4;
CREATE TABLE IF NOT EXISTS `inmobiliaria` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,
    `telefono` VARCHAR(20) NULL,
    `ubicacion` VARCHAR(255) NULL,
    `dominio` VARCHAR(255) NULL,
    `imagenLogo` VARCHAR(255) NULL,
    `imagenBanner` VARCHAR(255) NULL,
    `imagenPrincipal` VARCHAR(255) NULL,
    `fechaCreacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Inmobiliaria_1` (`dominio`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `roles` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(80) NOT NULL,
    `ambito` ENUM('PLATAFORMA', 'INMOBILIARIA') NOT NULL DEFAULT 'INMOBILIARIA',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Roles_1` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `estadosComerciales` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_EstadosComerciales_1` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `servicios` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Servicios_1` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tiposNotificaciones` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_TiposNotificaciones_1` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `estadosVisitas` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Estados_visitas_1` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `categorias` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Categorías_1` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tiposPropiedades` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_TiposPropiedades_1` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tiposParticipacion` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_TiposParticipacion_1` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `estadosContratos` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_EstadosContratos_1` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tiposContratos` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_TiposContratos_1` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `estadosPagos` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Estados_pagos_1` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `estadosReportes` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Estados_reportes_1` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `estadosCobros` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Estados_cobros_1` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `conceptosPago` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `idInmobiliaria` INT NULL,
    `tenantClave` INT GENERATED ALWAYS AS (COALESCE(`idInmobiliaria`, 0)) STORED,
    `nombre` VARCHAR(255) NOT NULL,
    `descripcion` VARCHAR(255) NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_ConceptosPago_tenant_id` (`id`, `tenantClave`),
    UNIQUE KEY `uq_ConceptosPago_1` (`tenantClave`, `nombre`),
    CONSTRAINT `fk_ConceptosPago_inmobiliaria` FOREIGN KEY (`idInmobiliaria`) REFERENCES `inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `areas` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `idInmobiliaria` INT NOT NULL,
    `nombre` VARCHAR(255) NOT NULL COMMENT 'Ciudad o localidad de la provincia de Buenos Aires',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Areas_tenant_id` (`idInmobiliaria`, `id`),
    UNIQUE KEY `uq_Areas_1` (`idInmobiliaria`, `nombre`),
    CONSTRAINT `fk_001` FOREIGN KEY (`idInmobiliaria`) REFERENCES `inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `personas` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `idInmobiliaria` INT NULL,
    `tenantClave` INT GENERATED ALWAYS AS (COALESCE(`idInmobiliaria`, 0)) STORED,
    `nombre` VARCHAR(255) NULL,
    `apellido` VARCHAR(255) NULL,
    `correo` VARCHAR(255) NULL,
    `dni` VARCHAR(20) NULL,
    `telefono` VARCHAR(20) NULL,
    `direccion` VARCHAR(255) NULL,
    `fotoPerfil` VARCHAR(255) NULL,
    `fechaCreacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Personas_tenant_id` (`idInmobiliaria`, `id`),
    UNIQUE KEY `uq_Personas_id_namespace` (`id`, `tenantClave`),
    UNIQUE KEY `uq_Personas_1` (`tenantClave`, `dni`),
    UNIQUE KEY `uq_Personas_2` (`tenantClave`, `correo`),
    KEY `idx_Personas_1` (`apellido`, `nombre`),
    CONSTRAINT `fk_002` FOREIGN KEY (`idInmobiliaria`) REFERENCES `inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `ck_Personas_id_inmobiliaria_positiva` CHECK (`idInmobiliaria` IS NULL OR `idInmobiliaria` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `usuarios` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `idInmobiliaria` INT NULL,
    `tenantClave` INT GENERATED ALWAYS AS (COALESCE(`idInmobiliaria`, 0)) STORED,
    `idPersona` INT NOT NULL,
    `idRol` INT NOT NULL,
    `usuario` VARCHAR(255) NULL,
    `passwordHash` VARCHAR(255) NULL,
    `googleSub` VARCHAR(255) NULL,
    `fechaActivacion` DATETIME NULL,
    `ultimoAcceso` DATETIME NULL,
    `fechaCreacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Usuarios_tenant_id` (`idInmobiliaria`, `id`),
    UNIQUE KEY `uq_Usuarios_1` (`idPersona`),
    UNIQUE KEY `uq_Usuarios_2` (`tenantClave`, `usuario`),
    UNIQUE KEY `uq_Usuarios_3` (`tenantClave`, `googleSub`),
    KEY `idx_Usuarios_1` (`idRol`),
    CONSTRAINT `fk_003` FOREIGN KEY (`idInmobiliaria`) REFERENCES `inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_004` FOREIGN KEY (`idPersona`) REFERENCES `personas` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_005` FOREIGN KEY (`idPersona`, `tenantClave`) REFERENCES `personas` (`id`, `tenantClave`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_006` FOREIGN KEY (`idRol`) REFERENCES `roles` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `ck_Usuarios_id_inmobiliaria_positiva` CHECK (`idInmobiliaria` IS NULL OR `idInmobiliaria` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tokensAcceso` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `idUsuario` INT NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `proposito` ENUM('ACTIVACION','RECUPERACION') NOT NULL,
    `fechaCreacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `fechaExpiracion` DATETIME NOT NULL,
    `fechaUso` DATETIME NULL,
    `intentosDni` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_TokensAcceso_1` (`tokenHash`),
    KEY `idx_TokensAcceso_1` (`idUsuario`, `proposito`, `fechaExpiracion`),
    CONSTRAINT `fk_007` FOREIGN KEY (`idUsuario`) REFERENCES `usuarios` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `ck_19_1` CHECK (`fechaExpiracion` > `fechaCreacion`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sesionesRevocadas` (
    `tokenHash` CHAR(64) NOT NULL,
    `idUsuario` INT NOT NULL,
    `fechaExpiracion` DATETIME NOT NULL,
    `fechaRevocacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`tokenHash`),
    KEY `idx_SesionesRevocadas_1` (`fechaExpiracion`),
    CONSTRAINT `fk_SesionesRevocadas_usuario` FOREIGN KEY (`idUsuario`) REFERENCES `usuarios` (`id`) ON UPDATE RESTRICT ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `agentes` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `idInmobiliaria` INT NOT NULL,
    `idPersona` INT NOT NULL,
    `idArea` INT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Agentes_tenant_id` (`idInmobiliaria`, `id`),
    UNIQUE KEY `uq_Agentes_1` (`idPersona`),
    CONSTRAINT `fk_008` FOREIGN KEY (`idInmobiliaria`) REFERENCES `inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_009` FOREIGN KEY (`idInmobiliaria`, `idPersona`) REFERENCES `personas` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_010` FOREIGN KEY (`idInmobiliaria`, `idArea`) REFERENCES `areas` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `propietarios` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `idInmobiliaria` INT NOT NULL,
    `idPersona` INT NOT NULL,
    `cbu` VARCHAR(22) NULL,
    `alias` VARCHAR(255) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Propietarios_tenant_id` (`idInmobiliaria`, `id`),
    UNIQUE KEY `uq_Propietarios_1` (`idPersona`),
    CONSTRAINT `fk_011` FOREIGN KEY (`idInmobiliaria`) REFERENCES `inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_012` FOREIGN KEY (`idInmobiliaria`, `idPersona`) REFERENCES `personas` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inquilinos` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `idInmobiliaria` INT NOT NULL,
    `idPersona` INT NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT TRUE,
    `idPropiedad` INT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Inquilinos_tenant_id` (`idInmobiliaria`, `id`),
    UNIQUE KEY `uq_Inquilinos_persona` (`idPersona`),
    CONSTRAINT `fk_Inquilinos_inmobiliaria` FOREIGN KEY (`idInmobiliaria`) REFERENCES `inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_Inquilinos_persona` FOREIGN KEY (`idInmobiliaria`, `idPersona`) REFERENCES `personas` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `profesionales` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `idInmobiliaria` INT NOT NULL,
    `idPersona` INT NOT NULL,
    `profesion` VARCHAR(255) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Profesionales_tenant_id` (`idInmobiliaria`, `id`),
    UNIQUE KEY `uq_Profesionales_1` (`idPersona`),
    CONSTRAINT `fk_015` FOREIGN KEY (`idInmobiliaria`) REFERENCES `inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_016` FOREIGN KEY (`idInmobiliaria`, `idPersona`) REFERENCES `personas` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `propiedades` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `idInmobiliaria` INT NOT NULL,
    `idEstadoComercial` INT NOT NULL,
    `idTipo` INT NOT NULL,
    `operacion` VARCHAR(10) NOT NULL DEFAULT 'Venta',
    `idAgente` INT NULL,
    `nombre` VARCHAR(255) NOT NULL,
    `descripcion` TEXT NULL,
    `ubicacion` VARCHAR(255) NULL,
    `precio` DECIMAL(12,2) NULL,
    `moneda` CHAR(3) NOT NULL DEFAULT 'ARS',
    `publicada` BOOLEAN NOT NULL DEFAULT FALSE,
    `tamanio` DECIMAL(10,2) NULL,
    `antiguedad` INT NULL,
    `banios` INT NULL,
    `habitaciones` INT NULL,
    `datosContrato` JSON NULL,
    `fechaCreacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Propiedades_tenant_id` (`idInmobiliaria`, `id`),
    KEY `idx_Propiedades_1` (`idInmobiliaria`, `publicada`),
    CONSTRAINT `fk_017` FOREIGN KEY (`idInmobiliaria`) REFERENCES `inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_018` FOREIGN KEY (`idEstadoComercial`) REFERENCES `estadosComerciales` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_019` FOREIGN KEY (`idTipo`) REFERENCES `tiposPropiedades` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_020` FOREIGN KEY (`idInmobiliaria`, `idAgente`) REFERENCES `agentes` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `ck_24_1` CHECK (`moneda` IN ('ARS','USD')),
    CONSTRAINT `ck_24_2` CHECK (`precio` IS NULL OR `precio` >= 0),
    CONSTRAINT `ck_24_3` CHECK (`tamanio` IS NULL OR `tamanio` > 0),
    CONSTRAINT `ck_24_4` CHECK (`operacion` IN ('Venta','Alquiler'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `inquilinos`
    ADD CONSTRAINT `fk_Inquilinos_propiedad` FOREIGN KEY (`idInmobiliaria`, `idPropiedad`)
    REFERENCES `propiedades` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS `clientes` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `idInmobiliaria` INT NOT NULL,
    `idPersona` INT NOT NULL,
    `interes` ENUM('COMPRA','ALQUILER','AMBOS') NOT NULL,
    `idPropiedadInteres` INT NULL,
    `estadoSeguimiento` VARCHAR(80) NOT NULL DEFAULT 'NUEVO',
    `observaciones` TEXT NULL,
    `fechaContacto` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Clientes_tenant_id` (`idInmobiliaria`, `id`),
    UNIQUE KEY `uq_Clientes_1` (`idPersona`),
    CONSTRAINT `fk_013` FOREIGN KEY (`idInmobiliaria`) REFERENCES `inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_014` FOREIGN KEY (`idInmobiliaria`, `idPersona`) REFERENCES `personas` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_clientes_propiedad_interes` FOREIGN KEY (`idInmobiliaria`, `idPropiedadInteres`) REFERENCES `propiedades` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `propiedadesPersonas` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `idInmobiliaria` INT NOT NULL,
    `idPropiedad` INT NOT NULL,
    `idPersona` INT NOT NULL,
    `idTipoParticipacion` INT NOT NULL,
    `porcentajeTitularidad` DECIMAL(7,4) NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_propiedades_personas_tenant_id` (`idInmobiliaria`, `id`),
    UNIQUE KEY `uq_propiedades_personas_1` (`idPropiedad`, `idPersona`, `idTipoParticipacion`),
    CONSTRAINT `fk_021` FOREIGN KEY (`idInmobiliaria`) REFERENCES `inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_022` FOREIGN KEY (`idInmobiliaria`, `idPropiedad`) REFERENCES `propiedades` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_023` FOREIGN KEY (`idInmobiliaria`, `idPersona`) REFERENCES `personas` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_024` FOREIGN KEY (`idTipoParticipacion`) REFERENCES `tiposParticipacion` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `ck_25_1` CHECK (`porcentajeTitularidad` IS NULL OR (`porcentajeTitularidad` >= 0 AND `porcentajeTitularidad` <= 100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `propiedadesImagenes` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `idInmobiliaria` INT NOT NULL,
    `idPropiedad` INT NOT NULL,
    `nombre` VARCHAR(255) NOT NULL,
    `orden` INT NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_propiedades_imagenes_tenant_id` (`idInmobiliaria`, `id`),
    CONSTRAINT `fk_025` FOREIGN KEY (`idInmobiliaria`) REFERENCES `inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_026` FOREIGN KEY (`idInmobiliaria`, `idPropiedad`) REFERENCES `propiedades` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `propiedadesServicios` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `idInmobiliaria` INT NOT NULL,
    `idPropiedad` INT NOT NULL,
    `idServicio` INT NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_propiedades_servicios_tenant_id` (`idInmobiliaria`, `id`),
    UNIQUE KEY `uq_propiedades_servicios_1` (`idPropiedad`, `idServicio`),
    CONSTRAINT `fk_027` FOREIGN KEY (`idInmobiliaria`) REFERENCES `inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_028` FOREIGN KEY (`idInmobiliaria`, `idPropiedad`) REFERENCES `propiedades` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_029` FOREIGN KEY (`idServicio`) REFERENCES `servicios` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `visitas` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `idInmobiliaria` INT NOT NULL,
    `idPersona` INT NOT NULL,
    `idPropiedad` INT NOT NULL,
    `idAgente` INT NULL,
    `idEstado` INT NOT NULL,
    `fecha` DATETIME NOT NULL,
    `motivoCancelacion` VARCHAR(500) NULL,
    `fechaCancelacion` DATETIME NULL,
    `fechaCreacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Visitas_tenant_id` (`idInmobiliaria`, `id`),
    KEY `idx_Visitas_1` (`idInmobiliaria`, `fecha`),
    CONSTRAINT `fk_030` FOREIGN KEY (`idInmobiliaria`) REFERENCES `inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_031` FOREIGN KEY (`idInmobiliaria`, `idPersona`) REFERENCES `personas` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_032` FOREIGN KEY (`idInmobiliaria`, `idPropiedad`) REFERENCES `propiedades` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_033` FOREIGN KEY (`idInmobiliaria`, `idAgente`) REFERENCES `agentes` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_034` FOREIGN KEY (`idEstado`) REFERENCES `estadosVisitas` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `reportes` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `idInmobiliaria` INT NOT NULL,
    `idPropiedad` INT NOT NULL,
    `idCategoria` INT NOT NULL,
    `idEstado` INT NOT NULL,
    `idPersonaReporta` INT NOT NULL,
    `idProfesional` INT NULL,
    `titulo` VARCHAR(255) NOT NULL,
    `descripcion` TEXT NULL,
    `fecha` DATE NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Reportes_tenant_id` (`idInmobiliaria`, `id`),
    KEY `idx_Reportes_1` (`idInmobiliaria`, `idEstado`),
    CONSTRAINT `fk_035` FOREIGN KEY (`idInmobiliaria`) REFERENCES `inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_036` FOREIGN KEY (`idInmobiliaria`, `idPropiedad`) REFERENCES `propiedades` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_037` FOREIGN KEY (`idCategoria`) REFERENCES `categorias` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_038` FOREIGN KEY (`idEstado`) REFERENCES `estadosReportes` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_039` FOREIGN KEY (`idInmobiliaria`, `idPersonaReporta`) REFERENCES `personas` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_040` FOREIGN KEY (`idInmobiliaria`, `idProfesional`) REFERENCES `profesionales` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `reportesImagenes` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `idInmobiliaria` INT NOT NULL,
    `idReporte` INT NOT NULL,
    `nombre` VARCHAR(255) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_reportes_imagenes_tenant_id` (`idInmobiliaria`, `id`),
    CONSTRAINT `fk_041` FOREIGN KEY (`idInmobiliaria`) REFERENCES `inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_042` FOREIGN KEY (`idInmobiliaria`, `idReporte`) REFERENCES `reportes` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `valoracionesProfesionales` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `idInmobiliaria` INT NOT NULL,
    `idProfesional` INT NOT NULL,
    `idPersonaAutora` INT NOT NULL,
    `idReporte` INT NULL,
    `puntuacion` TINYINT NOT NULL,
    `comentario` TEXT NULL,
    `fecha` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_ValoracionesProfesionales_tenant_id` (`idInmobiliaria`, `id`),
    UNIQUE KEY `uq_ValoracionesProfesionales_1` (`idReporte`, `idPersonaAutora`),
    CONSTRAINT `fk_043` FOREIGN KEY (`idInmobiliaria`) REFERENCES `inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_044` FOREIGN KEY (`idInmobiliaria`, `idProfesional`) REFERENCES `profesionales` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_045` FOREIGN KEY (`idInmobiliaria`, `idPersonaAutora`) REFERENCES `personas` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_046` FOREIGN KEY (`idInmobiliaria`, `idReporte`) REFERENCES `reportes` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `ck_31_1` CHECK (`puntuacion` BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS `contratos` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `idInmobiliaria` INT NOT NULL,
    `idTipoContrato` INT NOT NULL,
    `idEstadoContrato` INT NOT NULL,
    `idPropiedad` INT NOT NULL,
    `idContratoAnterior` INT NULL,
    `fechaFirma` DATE NULL,
    `fechaInicio` DATE NULL,
    `fechaFin` DATE NULL,
    `mesesDeAviso` INT NOT NULL DEFAULT 0,
    `mesesAumento` INT NULL,
    `tipoAumento` ENUM('FIJO','INDEC') NULL,
    `valorAumentoFijo` DECIMAL(12,2) NULL,
    `condiciones` TEXT NULL,
    `montoAcordado` DECIMAL(12,2) NOT NULL,
    `moneda` CHAR(3) NOT NULL DEFAULT 'ARS',
    `periodicidadPago` ENUM('UNICO','MENSUAL') NOT NULL,
    `fechaAnulacion` DATETIME NULL,
    `motivoAnulacion` VARCHAR(255) NULL,
    `fechaRescision` DATE NULL,
    `motivoRescision` VARCHAR(500) NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Contratos_tenant_id` (`idInmobiliaria`, `id`),
    UNIQUE KEY `uq_Contratos_1` (`idInmobiliaria`, `idPropiedad`, `id`),
    CONSTRAINT `fk_047` FOREIGN KEY (`idInmobiliaria`) REFERENCES `inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_048` FOREIGN KEY (`idTipoContrato`) REFERENCES `tiposContratos` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_049` FOREIGN KEY (`idEstadoContrato`) REFERENCES `estadosContratos` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_050` FOREIGN KEY (`idInmobiliaria`, `idPropiedad`) REFERENCES `propiedades` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_051` FOREIGN KEY (`idInmobiliaria`, `idPropiedad`, `idContratoAnterior`) REFERENCES `contratos` (`idInmobiliaria`, `idPropiedad`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `ck_32_1` CHECK (`moneda` IN ('ARS','USD')),
    CONSTRAINT `ck_32_2` CHECK (`mesesDeAviso` >= 0),
    CONSTRAINT `ck_32_3` CHECK (`montoAcordado` >= 0),
    CONSTRAINT `ck_32_4` CHECK (`fechaFin` IS NULL OR `fechaInicio` IS NULL OR `fechaFin` >= `fechaInicio`),
    CONSTRAINT `ck_32_5` CHECK (`mesesAumento` IS NULL OR `mesesAumento` > 0),
    CONSTRAINT `ck_32_6` CHECK (`valorAumentoFijo` IS NULL OR `valorAumentoFijo` >= 0),
    CONSTRAINT `ck_32_7` CHECK (`fechaRescision` IS NULL OR `fechaInicio` IS NULL OR `fechaRescision` >= `fechaInicio`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `contratosPersonas` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `idInmobiliaria` INT NOT NULL,
    `idContrato` INT NOT NULL,
    `idPersona` INT NOT NULL,
    `idTipoParticipacion` INT NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_contratos_personas_tenant_id` (`idInmobiliaria`, `id`),
    UNIQUE KEY `uq_contratos_personas_1` (`idContrato`, `idPersona`, `idTipoParticipacion`),
    CONSTRAINT `fk_052` FOREIGN KEY (`idInmobiliaria`) REFERENCES `inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_053` FOREIGN KEY (`idInmobiliaria`, `idContrato`) REFERENCES `contratos` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_054` FOREIGN KEY (`idInmobiliaria`, `idPersona`) REFERENCES `personas` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_055` FOREIGN KEY (`idTipoParticipacion`) REFERENCES `tiposParticipacion` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `indec` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `idInmobiliaria` INT NOT NULL,
    `anio` SMALLINT NOT NULL,
    `mes` TINYINT NOT NULL,
    `valor` DECIMAL(9,4) NOT NULL,
    `fechaRegistro` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Indec_tenant_id` (`idInmobiliaria`, `id`),
    UNIQUE KEY `uq_Indec_1` (`idInmobiliaria`, `anio`, `mes`),
    CONSTRAINT `fk_056` FOREIGN KEY (`idInmobiliaria`) REFERENCES `inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `ck_34_1` CHECK (`mes` BETWEEN 1 AND 12)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ajustesAlquiler` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `idInmobiliaria` INT NOT NULL,
    `idContrato` INT NOT NULL,
    `fechaAplicacion` DATE NOT NULL,
    `montoAnterior` DECIMAL(12,2) NOT NULL,
    `porcentajeAplicado` DECIMAL(9,4) NOT NULL,
    `montoNuevo` DECIMAL(12,2) NOT NULL,
    `observaciones` VARCHAR(500) NULL,
    `fechaRegistro` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_AjustesAlquiler_tenant_id` (`idInmobiliaria`, `id`),
    UNIQUE KEY `uq_AjustesAlquiler_1` (`idContrato`, `fechaAplicacion`),
    CONSTRAINT `fk_057` FOREIGN KEY (`idInmobiliaria`) REFERENCES `inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_058` FOREIGN KEY (`idInmobiliaria`, `idContrato`) REFERENCES `contratos` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `ck_35_1` CHECK (`montoAnterior` >= 0),
    CONSTRAINT `ck_35_2` CHECK (`montoNuevo` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ajustesIndec` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `idInmobiliaria` INT NOT NULL,
    `idAjuste` INT NOT NULL,
    `idIndec` INT NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_ajustes_indec_tenant_id` (`idInmobiliaria`, `id`),
    UNIQUE KEY `uq_ajustes_indec_1` (`idAjuste`, `idIndec`),
    CONSTRAINT `fk_059` FOREIGN KEY (`idInmobiliaria`) REFERENCES `inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_060` FOREIGN KEY (`idInmobiliaria`, `idAjuste`) REFERENCES `ajustesAlquiler` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_061` FOREIGN KEY (`idInmobiliaria`, `idIndec`) REFERENCES `indec` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pagos` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `idInmobiliaria` INT NOT NULL,
    `idContrato` INT NOT NULL,
    `idPersona` INT NOT NULL,
    `idEstado` INT NOT NULL,
    `periodo` DATE NOT NULL,
    `monto` DECIMAL(12,2) NOT NULL,
    `medioPago` ENUM('TRANSFERENCIA','EFECTIVO','OTRO') NULL,
    `fechaVencimiento` DATETIME NOT NULL,
    `fechaPago` DATE NULL,
    `fechaRegistro` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `detalle` VARCHAR(255) NULL,
    `fechaAnulacion` DATETIME NULL,
    `motivoAnulacion` VARCHAR(255) NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Pagos_tenant_id` (`idInmobiliaria`, `id`),
    UNIQUE KEY `uq_Pagos_contrato_periodo` (`idInmobiliaria`, `idContrato`, `periodo`),
    KEY `idx_Pagos_1` (`idInmobiliaria`, `fechaVencimiento`),
    CONSTRAINT `fk_062` FOREIGN KEY (`idInmobiliaria`) REFERENCES `inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_063` FOREIGN KEY (`idInmobiliaria`, `idContrato`) REFERENCES `contratos` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_064` FOREIGN KEY (`idInmobiliaria`, `idPersona`) REFERENCES `personas` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_065` FOREIGN KEY (`idEstado`) REFERENCES `estadosPagos` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `ck_37_1` CHECK (`monto` >= 0),
    CONSTRAINT `ck_Pagos_periodo` CHECK (DAYOFMONTH(`periodo`) = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pagosConceptos` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `idInmobiliaria` INT NOT NULL,
    `idConcepto` INT NOT NULL,
    `conceptoTenantClave` INT NOT NULL DEFAULT 0,
    `idPago` INT NOT NULL,
    `monto` DECIMAL(12,2) NOT NULL,
    `detalle` VARCHAR(255) NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_pagos_conceptos_tenant_id` (`idInmobiliaria`, `id`),
    UNIQUE KEY `uq_pagos_conceptos_1` (`idConcepto`, `idPago`),
    KEY `idx_PagosConceptos_concepto_tenant` (`idConcepto`, `conceptoTenantClave`),
    CONSTRAINT `fk_066` FOREIGN KEY (`idInmobiliaria`) REFERENCES `inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_067` FOREIGN KEY (`idInmobiliaria`, `idPago`) REFERENCES `pagos` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_068` FOREIGN KEY (`idConcepto`, `conceptoTenantClave`) REFERENCES `conceptosPago` (`id`, `tenantClave`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `ck_38_1` CHECK (`monto` >= 0),
    CONSTRAINT `ck_PagosConceptos_tenant` CHECK (`conceptoTenantClave` = 0 OR `conceptoTenantClave` = `idInmobiliaria`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `comprobantes` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `idInmobiliaria` INT NOT NULL,
    `idPago` INT NOT NULL,
    `idPersonaCarga` INT NOT NULL,
    `idPersonaRevisora` INT NULL,
    `nombreArchivo` VARCHAR(255) NOT NULL,
    `rutaArchivo` VARCHAR(1024) NOT NULL,
    `estado` ENUM('PENDIENTE','APROBADO','RECHAZADO') NOT NULL DEFAULT 'PENDIENTE',
    `idPagoAprobado` INT GENERATED ALWAYS AS (CASE WHEN `estado` = 'APROBADO' THEN `idPago` ELSE NULL END) STORED,
    `motivoRechazo` VARCHAR(500) NULL,
    `fechaCarga` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `fechaRevision` DATETIME NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Comprobantes_tenant_id` (`idInmobiliaria`, `id`),
    KEY `idx_Comprobantes_1` (`idPago`, `fechaCarga`),
    UNIQUE KEY `uq_Comprobantes_aprobado` (`idPagoAprobado`),
    CONSTRAINT `fk_069` FOREIGN KEY (`idInmobiliaria`) REFERENCES `inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_070` FOREIGN KEY (`idInmobiliaria`, `idPago`) REFERENCES `pagos` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_071` FOREIGN KEY (`idInmobiliaria`, `idPersonaCarga`) REFERENCES `personas` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_072` FOREIGN KEY (`idInmobiliaria`, `idPersonaRevisora`) REFERENCES `personas` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `cobros` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `idInmobiliaria` INT NOT NULL,
    `idPago` INT NOT NULL,
    `idPropietario` INT NOT NULL,
    `idEstado` INT NOT NULL,
    `montoBruto` DECIMAL(12,2) NOT NULL,
    `comision` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    `descuentos` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    `detalleDescuentos` VARCHAR(500) NULL,
    `porcentajeComision` DECIMAL(7,4) NULL,
    `montoNeto` DECIMAL(12,2) GENERATED ALWAYS AS (`montoBruto` - `comision` - `descuentos`) STORED,
    `fechaGeneracion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `fechaCobro` DATETIME NULL,
    `detalle` VARCHAR(255) NULL,
    `nombreArchivo` VARCHAR(255) NULL,
    `rutaArchivo` VARCHAR(1024) NULL,
    `fechaComprobante` DATETIME NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Cobros_tenant_id` (`idInmobiliaria`, `id`),
    UNIQUE KEY `uq_Cobros_pago_propietario` (`idInmobiliaria`, `idPago`, `idPropietario`),
    KEY `idx_Cobros_1` (`idInmobiliaria`, `idPropietario`, `idEstado`),
    CONSTRAINT `fk_073` FOREIGN KEY (`idInmobiliaria`) REFERENCES `inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_074` FOREIGN KEY (`idInmobiliaria`, `idPago`) REFERENCES `pagos` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_075` FOREIGN KEY (`idInmobiliaria`, `idPropietario`) REFERENCES `propietarios` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_076` FOREIGN KEY (`idEstado`) REFERENCES `estadosCobros` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `ck_40_1` CHECK (`montoBruto` >= 0),
    CONSTRAINT `ck_40_2` CHECK (`comision` >= 0 AND `comision` <= `montoBruto`),
    CONSTRAINT `ck_40_3` CHECK (`porcentajeComision` IS NULL OR (`porcentajeComision` >= 0 AND `porcentajeComision` <= 100)),
    CONSTRAINT `ck_Cobros_descuentos` CHECK (`descuentos` >= 0 AND `comision` + `descuentos` <= `montoBruto`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS `notificaciones` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `idInmobiliaria` INT NOT NULL,
    `idTipo` INT NOT NULL,
    `titulo` VARCHAR(255) NOT NULL,
    `contenido` TEXT NOT NULL,
    `fechaCreacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Notificaciones_tenant_id` (`idInmobiliaria`, `id`),
    CONSTRAINT `fk_077` FOREIGN KEY (`idInmobiliaria`) REFERENCES `inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_078` FOREIGN KEY (`idTipo`) REFERENCES `tiposNotificaciones` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `personasNotificaciones` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `idInmobiliaria` INT NOT NULL,
    `idPersona` INT NOT NULL,
    `idNotificacion` INT NOT NULL,
    `leida` BOOLEAN NOT NULL DEFAULT FALSE,
    `fechaLectura` DATETIME NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_personas_notificaciones_tenant_id` (`idInmobiliaria`, `id`),
    UNIQUE KEY `uq_personas_notificaciones_1` (`idPersona`, `idNotificacion`),
    CONSTRAINT `fk_079` FOREIGN KEY (`idInmobiliaria`) REFERENCES `inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_personas_notificaciones_persona` FOREIGN KEY (`idInmobiliaria`, `idPersona`) REFERENCES `personas` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT `fk_081` FOREIGN KEY (`idInmobiliaria`, `idNotificacion`) REFERENCES `notificaciones` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `superadminsNotificaciones` (
    `idNotificacion` INT NOT NULL,
    `idUsuario` INT NOT NULL,
    `leida` BOOLEAN NOT NULL DEFAULT FALSE,
    `fechaLectura` DATETIME NULL,
    PRIMARY KEY (`idUsuario`, `idNotificacion`),
    CONSTRAINT `fk_superadmins_notificaciones_usuario` FOREIGN KEY (`idUsuario`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_superadmins_notificaciones_notificacion` FOREIGN KEY (`idNotificacion`) REFERENCES `notificaciones` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `conversaciones` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `idInmobiliaria` INT NOT NULL,
    `idPersona1` INT NULL,
    `idPersona2` INT NULL,
    `fechaCreacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Conversaciones_tenant_id` (`idInmobiliaria`, `id`),
    UNIQUE KEY `uq_Conversaciones_1` (`idInmobiliaria`, `idPersona1`, `idPersona2`),
    CONSTRAINT `fk_082` FOREIGN KEY (`idInmobiliaria`) REFERENCES `inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_083` FOREIGN KEY (`idInmobiliaria`, `idPersona1`) REFERENCES `personas` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_084` FOREIGN KEY (`idInmobiliaria`, `idPersona2`) REFERENCES `personas` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `ck_43_1` CHECK (`idPersona1` <> `idPersona2`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `conversacionesEstado` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `idInmobiliaria` INT NOT NULL,
    `idConversacion` INT NOT NULL,
    `idPersona` INT NOT NULL,
    `fechaUltimaLectura` DATETIME NULL,
    `idUltimoMensajeLeido` INT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_conversaciones_estado_tenant_id` (`idInmobiliaria`, `id`),
    UNIQUE KEY `uq_conversaciones_estado_1` (`idConversacion`, `idPersona`),
    CONSTRAINT `fk_085` FOREIGN KEY (`idInmobiliaria`) REFERENCES `inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_086` FOREIGN KEY (`idInmobiliaria`, `idConversacion`) REFERENCES `conversaciones` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_087` FOREIGN KEY (`idInmobiliaria`, `idPersona`) REFERENCES `personas` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `mensajes` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `idInmobiliaria` INT NOT NULL,
    `idPersona` INT NULL,
    `idConversacion` INT NOT NULL,
    `fecha` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `contenido` TEXT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Mensajes_tenant_id` (`idInmobiliaria`, `id`),
    KEY `idx_Mensajes_1` (`idConversacion`, `fecha`),
    CONSTRAINT `fk_088` FOREIGN KEY (`idInmobiliaria`) REFERENCES `inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_089` FOREIGN KEY (`idInmobiliaria`, `idPersona`) REFERENCES `personas` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_090` FOREIGN KEY (`idInmobiliaria`, `idConversacion`) REFERENCES `conversaciones` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `mensajesAdjuntos` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `idInmobiliaria` INT NOT NULL,
    `idMensaje` INT NOT NULL,
    `nombreArchivo` VARCHAR(255) NOT NULL,
    `rutaArchivo` VARCHAR(1024) NOT NULL,
    `mimeType` VARCHAR(150) NULL,
    `tamanioBytes` BIGINT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_mensajes_adjuntos_tenant_id` (`idInmobiliaria`, `id`),
    CONSTRAINT `fk_091` FOREIGN KEY (`idInmobiliaria`) REFERENCES `inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_092` FOREIGN KEY (`idInmobiliaria`, `idMensaje`) REFERENCES `mensajes` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `ck_46_1` CHECK (`tamanioBytes` IS NULL OR `tamanioBytes` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `documentos` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `idInmobiliaria` INT NOT NULL,
    `idPropiedad` INT NULL,
    `idContrato` INT NULL,
    `idPersona` INT NULL,
    `idReporte` INT NULL,
    `idCobro` INT NULL,
    `titulo` VARCHAR(255) NOT NULL,
    `tipo` VARCHAR(100) NULL,
    `visibilidad` ENUM('INTERNA','PARTES') NOT NULL DEFAULT 'INTERNA',
    `fechaCreacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `fechaArchivado` DATETIME NULL,
    `motivoArchivo` VARCHAR(500) NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_Documentos_tenant_id` (`idInmobiliaria`, `id`),
    CONSTRAINT `fk_096` FOREIGN KEY (`idInmobiliaria`) REFERENCES `inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_097` FOREIGN KEY (`idInmobiliaria`, `idPropiedad`) REFERENCES `propiedades` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_098` FOREIGN KEY (`idInmobiliaria`, `idContrato`) REFERENCES `contratos` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_099` FOREIGN KEY (`idInmobiliaria`, `idPersona`) REFERENCES `personas` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_100` FOREIGN KEY (`idInmobiliaria`, `idReporte`) REFERENCES `reportes` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_101` FOREIGN KEY (`idInmobiliaria`, `idCobro`) REFERENCES `cobros` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `ck_48_1` CHECK (`idPropiedad` IS NOT NULL OR `idContrato` IS NOT NULL OR `idPersona` IS NOT NULL OR `idReporte` IS NOT NULL OR `idCobro` IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `versionesDocumentos` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `idInmobiliaria` INT NOT NULL,
    `idDocumento` INT NOT NULL,
    `numeroVersion` INT NOT NULL,
    `nombreArchivo` VARCHAR(255) NOT NULL,
    `rutaArchivo` VARCHAR(1024) NOT NULL,
    `mimeType` VARCHAR(150) NULL,
    `tamanioBytes` BIGINT NULL,
    `idUsuarioAutor` INT NULL,
    `fechaCreacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `comentario` VARCHAR(500) NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_VersionesDocumentos_tenant_id` (`idInmobiliaria`, `id`),
    UNIQUE KEY `uq_VersionesDocumentos_1` (`idDocumento`, `numeroVersion`),
    CONSTRAINT `fk_102` FOREIGN KEY (`idInmobiliaria`) REFERENCES `inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_103` FOREIGN KEY (`idInmobiliaria`, `idDocumento`) REFERENCES `documentos` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_104` FOREIGN KEY (`idInmobiliaria`, `idUsuarioAutor`) REFERENCES `usuarios` (`idInmobiliaria`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `ck_49_1` CHECK (`numeroVersion` > 0),
    CONSTRAINT `ck_49_2` CHECK (`tamanioBytes` IS NULL OR `tamanioBytes` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `contVisitas` (
    `idInmobiliaria` INT NOT NULL,
    `fecha` DATE NOT NULL,
    `cantidad` INT NOT NULL DEFAULT 0,
    PRIMARY KEY (`idInmobiliaria`, `fecha`),
    CONSTRAINT `fk_ContVisitas_inmobiliaria` FOREIGN KEY (`idInmobiliaria`) REFERENCES `inmobiliaria` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `ck_ContVisitas_1` CHECK (`cantidad` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `roles` (`nombre`, `ambito`) VALUES
    ('Superadministrador', 'PLATAFORMA'),
    ('Administrador', 'INMOBILIARIA'),
    ('Agente inmobiliario', 'INMOBILIARIA'),
    ('Propietario', 'INMOBILIARIA'),
    ('Inquilino', 'INMOBILIARIA')
ON DUPLICATE KEY UPDATE `ambito` = VALUES(`ambito`);

INSERT IGNORE INTO `tiposContratos` (`nombre`) VALUES ('Alquiler'), ('Venta');
INSERT IGNORE INTO `tiposNotificaciones` (`nombre`) VALUES
    ('Cuenta'), ('Contrato'), ('Mantenimiento'), ('Mensaje'), ('Pago'), ('Visita');
INSERT IGNORE INTO `tiposParticipacion` (`nombre`) VALUES
    ('Propietario'), ('Inquilino'), ('Comprador'), ('Vendedor'), ('Garante');

INSERT IGNORE INTO `estadosComerciales` (`nombre`) VALUES
    ('Disponible'), ('Reservada'), ('Alquilada'), ('Vendida'), ('Inactiva');
INSERT IGNORE INTO `tiposPropiedades` (`nombre`) VALUES
    ('Casa'), ('Departamento'), ('Local'), ('Terreno');
INSERT IGNORE INTO `servicios` (`nombre`) VALUES
    ('Agua'), ('Gas'), ('Luz'), ('Estacionamiento');
INSERT IGNORE INTO `estadosVisitas` (`nombre`) VALUES
    ('Programada'), ('Realizada'), ('Cancelada');
INSERT IGNORE INTO `estadosContratos` (`nombre`) VALUES
    ('Borrador'), ('Vigente'), ('Finalizado'), ('Rescindido'), ('Anulado');
INSERT IGNORE INTO `estadosPagos` (`nombre`) VALUES
    ('Pendiente'), ('En revision'), ('Aprobado'), ('Rechazado'), ('Anulado');
INSERT IGNORE INTO `estadosReportes` (`nombre`) VALUES
    ('Abierto'), ('En proceso'), ('Resuelto');
INSERT IGNORE INTO `categorias` (`nombre`) VALUES
    ('Plomería'), ('Electricidad'), ('Gas'), ('Pintura'), ('Carpintería'), ('Otro');
INSERT IGNORE INTO `estadosCobros` (`nombre`) VALUES
    ('Pendiente'), ('Liquidado'), ('Anulado');
