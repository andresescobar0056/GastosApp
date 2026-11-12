<?php
/**
 * Modelo de Usuario (users)
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
        $user = $stmt->fetch();
        return $user ?: null;
    }

    public function findByUsername(string $username): ?array {
        $stmt = $this->db->prepare("SELECT * FROM users WHERE username = :username LIMIT 1");
        $stmt->execute(['username' => trim($username)]);
        $user = $stmt->fetch();
        return $user ?: null;
    }

    public function findById(int $id): ?array {
        $stmt = $this->db->prepare("SELECT id, username, email, avatar_path, status, created_at FROM users WHERE id = :id LIMIT 1");
        $stmt->execute(['id' => $id]);
        $user = $stmt->fetch();
        return $user ?: null;
    }

    public function updateAvatar(int $id, string $avatarPath): bool {
        $stmt = $this->db->prepare("UPDATE users SET avatar_path = :avatar_path, updated_at = NOW() WHERE id = :id");
        return $stmt->execute(['avatar_path' => $avatarPath, 'id' => $id]);
    }

    public function create(string $username, string $email, string $password): int {
        $passwordHash = password_hash($password, PASSWORD_DEFAULT);
        
        $sql = "INSERT INTO users (username, email, password, status, created_at, updated_at)
                VALUES (:username, :email, :password, 'active', NOW(), NOW())";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'username' => trim($username),
            'email'    => strtolower(trim($email)),
            'password' => $passwordHash,
        ]);

        return (int)$this->db->lastInsertId();
    }

    public function verifyPassword(string $plainPassword, string $hash): bool {
        return password_verify($plainPassword, $hash);
    }
}
