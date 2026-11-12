-- Migración: agregar columna avatar_path a la tabla users
-- Ejecutar una sola vez en phpMyAdmin o cualquier cliente MySQL

ALTER TABLE `users`
  ADD COLUMN `avatar_path` VARCHAR(255) NULL DEFAULT NULL
  AFTER `email`;
