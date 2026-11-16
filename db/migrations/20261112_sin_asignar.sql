
DROP TABLE IF EXISTS tareas;


ALTER TABLE visitas
  MODIFY idAgente INT NULL;

ALTER TABLE versionesDocumentos
  MODIFY idUsuarioAutor INT NULL;


ALTER TABLE conversaciones
  MODIFY idPersona1 INT NULL,
  MODIFY idPersona2 INT NULL;

ALTER TABLE mensajes
  MODIFY idPersona INT NULL;
