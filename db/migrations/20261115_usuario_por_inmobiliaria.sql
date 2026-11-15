-- El usuario puede repetirse en inmobiliarias distintas. La clave por tenant
-- uq_Usuarios_2 permanece vigente. Es segura de repetir en bases actualizadas.
SET @usuario_global_index = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'usuarios'
    AND index_name = 'uq_Usuarios_usuario_global'
);
SET @usuario_global_sql = IF(
  @usuario_global_index > 0,
  'ALTER TABLE `usuarios` DROP INDEX `uq_Usuarios_usuario_global`',
  'SELECT 1'
);
PREPARE usuario_global_stmt FROM @usuario_global_sql;
EXECUTE usuario_global_stmt;
DEALLOCATE PREPARE usuario_global_stmt;
