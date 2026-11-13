-- El login se realiza solo con nombre de usuario, por lo que debe ser único en todo el sistema.
ALTER TABLE usuarios
  ADD UNIQUE KEY uq_Usuarios_usuario_global (usuario);

ALTER TABLE personas
  MODIFY COLUMN nombre VARCHAR(255) NULL,
  MODIFY COLUMN apellido VARCHAR(255) NULL;
