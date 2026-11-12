<?php
/**
 * Conexión Segura a Base de Datos MySQL mediante PDO
 */

class Database {
    private static ?PDO $instance = null;

    private static string $host = '127.0.0.1';
    private static string $dbName = 'control_gastos';
    private static string $username = 'root';
    private static string $password = '';
    private static string $charset = 'utf8mb4';

    public static function getConnection(): PDO {
        if (self::$instance === null) {
            $dsn = "mysql:host=" . self::$host . ";dbname=" . self::$dbName . ";charset=" . self::$charset;
            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ];

            try {
                self::$instance = new PDO($dsn, self::$username, self::$password, $options);
            } catch (PDOException $e) {
                // Si la base de datos no existe aún, intentar conectar sin dbname
                try {
                    $dsnBase = "mysql:host=" . self::$host . ";charset=" . self::$charset;
                    $pdoBase = new PDO($dsnBase, self::$username, self::$password, $options);
                    $pdoBase->exec("CREATE DATABASE IF NOT EXISTS `" . self::$dbName . "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");
                    self::$instance = new PDO($dsn, self::$username, self::$password, $options);
                } catch (PDOException $e2) {
                    http_response_code(500);
                    echo json_encode([
                        'success' => false,
                        'message' => 'Error de conexión a la base de datos MySQL en XAMPP: ' . $e2->getMessage()
                    ]);
                    exit;
                }
            }
        }

        return self::$instance;
    }
}
