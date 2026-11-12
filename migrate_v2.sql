-- =============================================================================
-- Migración v2 — SOLO para bases de datos creadas con el database.sql antiguo.
-- Si instalas desde cero con el database.sql actual, NO necesitas esto.
--
-- Ejecutar una sola vez en phpMyAdmin con tu base de datos seleccionada.
-- (Si nunca ejecutaste migrate_avatar.sql, ejecútalo antes que este.)
-- =============================================================================

-- 1. El nombre de usuario pasa a ser único (se usa para iniciar sesión).
--    Si este paso falla por "Duplicate entry", hay usuarios repetidos:
--    renómbralos antes con:  UPDATE users SET username = CONCAT(username, '_', id) WHERE id = <id>;
ALTER TABLE `users`
  ADD UNIQUE KEY `uk_users_username` (`username`);

-- 2. Tabla para limitar intentos de login (fuerza bruta).
CREATE TABLE IF NOT EXISTS `login_attempts` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ip` VARCHAR(45) NOT NULL,
  `identifier` VARCHAR(150) NOT NULL,
  `attempted_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_login_attempts_ip` (`ip`, `attempted_at`),
  KEY `idx_login_attempts_identifier` (`identifier`, `attempted_at`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
