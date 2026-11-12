<?php
/**
 * Modelo de Categorías (categories)
 */

require_once __DIR__ . '/../config/database.php';

class Category {
    private PDO $db;

    public function __construct() {
        $this->db = Database::getConnection();
    }

    public function getForUser(?int $userId): array {
        $sql = "SELECT id, user_id, name, type, icon 
                FROM categories 
                WHERE user_id IS NULL OR user_id = :user_id 
                ORDER BY name ASC";
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['user_id' => $userId]);
        return $stmt->fetchAll();
    }

    public function findByName(string $name, ?int $userId): ?array {
        $sql = "SELECT id, name FROM categories 
                WHERE LOWER(name) = LOWER(:name) AND (user_id IS NULL OR user_id = :user_id) 
                LIMIT 1";
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['name' => trim($name), 'user_id' => $userId]);
        $res = $stmt->fetch();
        return $res ?: null;
    }

    public function create(string $name, ?int $userId = null, string $type = 'both', ?string $icon = 'tag'): int {
        $sql = "INSERT INTO categories (user_id, name, type, icon, created_at, updated_at) 
                VALUES (:user_id, :name, :type, :icon, NOW(), NOW())";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'user_id' => $userId,
            'name'    => trim($name),
            'type'    => $type,
            'icon'    => $icon
        ]);
        return (int)$this->db->lastInsertId();
    }
}
