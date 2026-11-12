<?php
/**
 * Modelo de Usuario (users) y registro de intentos de login (login_attempts).
 */

require_once __DIR__ . '/../config/database.php';

class User {
    private PDO $db;

    public function __construct() {
        $this->db = Database::getConnection();
    }

    public function findByEmail(string $email): ?array {
        $stmt = $this->db->prepare("SELECT * FROM users WHERE email = :email LIMIT 1");
        $stmt->execute(['email' => strtolower(trim($email))]);
        return $stmt->fetch() ?: null;
    }

    public function findByUsername(string $username): ?array {
        $stmt = $this->db->prepare("SELECT * FROM users WHERE username = :username LIMIT 1");
        $stmt->execute(['username' => trim($username)]);
        return $stmt->fetch() ?: null;
    }

    public function findById(int $id): ?array {
        $stmt = $this->db->prepare("SELECT id, username, email, avatar_path, status, created_at FROM users WHERE id = :id LIMIT 1");
        $stmt->execute(['id' => $id]);
        return $stmt->fetch() ?: null;
    }

    public function updateAvatar(int $id, string $avatarPath): bool {
        $stmt = $this->db->prepare("UPDATE users SET avatar_path = :avatar_path, updated_at = NOW() WHERE id = :id");
        return $stmt->execute(['avatar_path' => $avatarPath, 'id' => $id]);
    }

    public function create(string $username, string $email, string $password): int {
        $sql = "INSERT INTO users (username, email, password, status, created_at, updated_at)
                VALUES (:username, :email, :password, 'active', NOW(), NOW())";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'username' => trim($username),
            'email'    => strtolower(trim($email)),
            'password' => password_hash($password, PASSWORD_DEFAULT),
        ]);

        return (int)$this->db->lastInsertId();
    }

    public function verifyPassword(string $plainPassword, string $hash): bool {
        return password_verify($plainPassword, $hash);
    }

    /** Re-hashea la contraseña si PHP cambió el algoritmo/coste recomendado. */
    public function rehashIfNeeded(int $id, string $plainPassword, string $hash): void {
        if (password_needs_rehash($hash, PASSWORD_DEFAULT)) {
            $stmt = $this->db->prepare("UPDATE users SET password = :p WHERE id = :id");
            $stmt->execute(['p' => password_hash($plainPassword, PASSWORD_DEFAULT), 'id' => $id]);
        }
    }

    // ── Límite de intentos de login ──────────────────────────────────────────

    /** Cuenta intentos fallidos recientes para esta IP y para este identificador. */
    public function recentFailedAttempts(string $ip, string $identifier, int $minutes): array {
        $since = date('Y-m-d H:i:s', time() - $minutes * 60);

        $stmt = $this->db->prepare("SELECT COUNT(*) FROM login_attempts WHERE ip = :ip AND attempted_at > :since");
        $stmt->execute(['ip' => $ip, 'since' => $since]);
        $byIp = (int)$stmt->fetchColumn();

        $stmt = $this->db->prepare("SELECT COUNT(*) FROM login_attempts WHERE identifier = :id AND attempted_at > :since");
        $stmt->execute(['id' => $identifier, 'since' => $since]);
        $byIdentifier = (int)$stmt->fetchColumn();

        return ['ip' => $byIp, 'identifier' => $byIdentifier];
    }

    public function recordFailedAttempt(string $ip, string $identifier): void {
        $stmt = $this->db->prepare("INSERT INTO login_attempts (ip, identifier, attempted_at) VALUES (:ip, :id, :at)");
        $stmt->execute(['ip' => $ip, 'id' => $identifier, 'at' => date('Y-m-d H:i:s')]);

        // Limpieza oportunista de registros viejos (> 1 día)
        if (random_int(1, 50) === 1) {
            $this->db->prepare("DELETE FROM login_attempts WHERE attempted_at < :old")
                ->execute(['old' => date('Y-m-d H:i:s', time() - 86400)]);
        }
    }

    public function clearAttempts(string $identifier): void {
        $stmt = $this->db->prepare("DELETE FROM login_attempts WHERE identifier = :id");
        $stmt->execute(['id' => $identifier]);
    }
}
