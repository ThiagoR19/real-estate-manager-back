-- La tabla tareas no forma parte del sistema
DROP TABLE IF EXISTS tareas;

-- Al eliminar un agente o admin, lo que tenía asignado queda sin asignar (NULL)
ALTER TABLE visitas
  MODIFY idAgente INT NULL;

ALTER TABLE versionesDocumentos
  MODIFY idUsuarioAutor INT NULL;

-- Los chats se conservan: el participante y el autor eliminados pasan a NULL
ALTER TABLE conversaciones
  MODIFY idPersona1 INT NULL,
  MODIFY idPersona2 INT NULL;

ALTER TABLE mensajes
  MODIFY idPersona INT NULL;
