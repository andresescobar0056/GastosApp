<?php
/**
 * Conexión a MySQL mediante PDO.
 * Las credenciales se leen de config/config.php (ver config.example.php).
 */

require_once __DIR__ . '/response.php';

class Database {
    private static ?PDO $instance = null;
    private static ?array $config = null;

    public static function config(): array {
        if (self::$config === null) {
            $file = __DIR__ . '/config.php';
            if (!is_file($file)) {
                $file = __DIR__ . '/config.example.php';
            }
            self::$config = require $file;
        }
        return self::$config;
    }

    public static function getConnection(): PDO {
        if (self::$instance === null) {
            $c = self::config();
            $dsn = "mysql:host={$c['db_host']};dbname={$c['db_name']};charset=utf8mb4";
            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ];

            try {
                self::$instance = new PDO($dsn, $c['db_user'], $c['db_pass'], $options);
            } catch (PDOException $e) {
                // El detalle va al log del servidor, nunca al cliente
                error_log('[DB] Error de conexión: ' . $e->getMessage());
                jsonError('No se pudo conectar con la base de datos. Intenta más tarde.', 503);
            }
        }

        return self::$instance;
    }

    /**
     * Ejecuta $fn dentro de una transacción con el registro del usuario bloqueado
     * (SELECT ... FOR UPDATE). Así dos operaciones simultáneas del mismo usuario
     * se ejecutan en serie y la validación de saldo no puede saltarse.
     */
    public static function withUserLock(int $userId, callable $fn): mixed {
        $db = self::getConnection();
        $db->beginTransaction();
        try {
            $stmt = $db->prepare('SELECT id FROM users WHERE id = :id FOR UPDATE');
            $stmt->execute(['id' => $userId]);
            $result = $fn($db);
            $db->commit();
            return $result;
        } catch (Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            throw $e;
        }
    }
}
