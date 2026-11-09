-- Ejecutar una vez sobre una base existente antes de iniciar la API actualizada.
ALTER TABLE personas ADD COLUMN fotoPerfil VARCHAR(255) NULL AFTER direccion;
