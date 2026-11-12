-- =============================================================================
-- Base de Datos: control_gastos
-- Motor: MySQL / MariaDB (Optimizado para XAMPP y phpMyAdmin)
-- Codificación: UTF-8 Unicode (utf8mb4)
-- =============================================================================

CREATE DATABASE IF NOT EXISTS `control_gastos`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `control_gastos`;

-- Desactivar temporalmente revisión de claves foráneas para recreación limpia
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `transactions`;
DROP TABLE IF EXISTS `goals`;
DROP TABLE IF EXISTS `categories`;
DROP TABLE IF EXISTS `users`;

SET FOREIGN_KEY_CHECKS = 1;

-- -----------------------------------------------------------------------------
-- 1. TABLA: users
-- Almacena credenciales protegidas con hash, estado y auditoría
-- -----------------------------------------------------------------------------
CREATE TABLE `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(60) NOT NULL,
  `email` VARCHAR(150) NOT NULL,
  `avatar_path` VARCHAR(255) NULL DEFAULT NULL,
  `password` VARCHAR(255) NOT NULL, -- Compatible con password_hash() (Bcrypt / Argon2)
  `status` ENUM('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_users_email` (`email`),
  KEY `idx_users_status` (`status`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. TABLA: categories
-- Categorías globales (user_id = NULL) y personalizadas por usuario
-- -----------------------------------------------------------------------------
CREATE TABLE `categories` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NULL, -- NULL indica categoría predeterminada del sistema
  `name` VARCHAR(80) NOT NULL,
  `type` ENUM('income', 'expense', 'both') NOT NULL DEFAULT 'both',
  `icon` VARCHAR(50) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_categories_user` (`user_id`),
  CONSTRAINT `fk_categories_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. TABLA: transactions
-- Registro de ingresos y retiros/gastos con fotografía y categoría
-- -----------------------------------------------------------------------------
CREATE TABLE `transactions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `category_id` BIGINT UNSIGNED NULL,
  `type` ENUM('income', 'expense') NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `description` TEXT NULL,
  `amount` DECIMAL(15, 2) NOT NULL,
  `photo_path` VARCHAR(255) NULL,
  `transaction_date` DATE NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_transactions_user_date` (`user_id`, `transaction_date`),
  KEY `idx_transactions_category` (`category_id`),
  KEY `idx_transactions_type` (`type`),
  CONSTRAINT `chk_transaction_amount` CHECK (`amount` > 0),
  CONSTRAINT `fk_transactions_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_transactions_category`
    FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4. TABLA: goals
-- Metas de ahorro, cálculo del progreso y seguimiento para rangos
-- -----------------------------------------------------------------------------
CREATE TABLE `goals` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `description` TEXT NULL,
  `target_amount` DECIMAL(15, 2) NOT NULL,
  `current_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `progress_percentage` DECIMAL(6, 2) GENERATED ALWAYS AS (
    ROUND(LEAST(100.00, (current_amount / NULLIF(target_amount, 0)) * 100), 2)
  ) VIRTUAL,
  `target_date` DATE NULL,
  `image_path` VARCHAR(255) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_goals_user` (`user_id`),
  CONSTRAINT `chk_goals_target` CHECK (`target_amount` > 0),
  CONSTRAINT `chk_goals_current` CHECK (`current_amount` >= 0),
  CONSTRAINT `fk_goals_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. DATOS SEMILLA: Categorías Iniciales
-- Categorías predeterminadas sugeridas listas para todos los usuarios
-- -----------------------------------------------------------------------------
INSERT INTO `categories` (`user_id`, `name`, `type`, `icon`) VALUES
  (NULL, 'Comida', 'expense', 'utensils'),
  (NULL, 'Transporte', 'expense', 'car'),
  (NULL, 'Videojuegos', 'expense', 'gamepad'),
  (NULL, 'Trabajo', 'income', 'briefcase'),
  (NULL, 'Ahorro', 'both', 'piggy-bank'),
  (NULL, 'Servicios', 'expense', 'receipt'),
  (NULL, 'Salud', 'expense', 'heart-pulse'),
  (NULL, 'Educación', 'expense', 'graduation-cap'),
  (NULL, 'Freelance', 'income', 'laptop'),
  (NULL, 'Otros', 'both', 'tag');
