<?php
/**
 * Modelo de Transacciones y Movimientos (transactions)
 */

require_once __DIR__ . '/../config/database.php';

class Transaction {
    private PDO $db;

    public function __construct() {
        $this->db = Database::getConnection();
    }

    public function getBalance(int $userId): float {
        $sql = "SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) as balance 
                FROM transactions 
                WHERE user_id = :user_id";
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['user_id' => $userId]);
        $row = $stmt->fetch();
        return (float)($row['balance'] ?? 0.0);
    }

    public function getTotals(int $userId): array {
        $sql = "SELECT 
                    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
                    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense
                FROM transactions 
                WHERE user_id = :user_id";
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['user_id' => $userId]);
        $res = $stmt->fetch();
        return [
            'total_income'  => (float)($res['total_income'] ?? 0.0),
            'total_expense' => (float)($res['total_expense'] ?? 0.0)
        ];
    }

    public function getByUser(int $userId, ?string $type = null, ?string $search = null): array {
        $sql = "SELECT t.*, c.name as category_name, c.icon as category_icon 
                FROM transactions t
                LEFT JOIN categories c ON t.category_id = c.id
                WHERE t.user_id = :user_id";
        $params = ['user_id' => $userId];

        if ($type === 'income' || $type === 'expense') {
            $sql .= " AND t.type = :type";
            $params['type'] = $type;
        }

        if (!empty($search)) {
            $sql .= " AND (t.name LIKE :search OR t.description LIKE :search OR c.name LIKE :search)";
            $params['search'] = '%' . trim($search) . '%';
        }

        $sql .= " ORDER BY t.transaction_date DESC, t.id DESC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function getRecent(int $userId, int $limit = 4): array {
        $sql = "SELECT t.*, c.name as category_name, c.icon as category_icon 
                FROM transactions t
                LEFT JOIN categories c ON t.category_id = c.id
                WHERE t.user_id = :user_id
                ORDER BY t.transaction_date DESC, t.id DESC
                LIMIT :limit";
        $stmt = $this->db->prepare($sql);
        $stmt->bindValue(':user_id', $userId, PDO::PARAM_INT);
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public function getByIdAndUser(int $id, int $userId): ?array {
        $sql = "SELECT t.*, c.name as category_name, c.icon as category_icon 
                FROM transactions t
                LEFT JOIN categories c ON t.category_id = c.id
                WHERE t.id = :id AND t.user_id = :user_id
                LIMIT 1";
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['id' => $id, 'user_id' => $userId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function create(
        int $userId, 
        string $type, 
        string $name, 
        ?string $description, 
        float $amount, 
        ?int $categoryId, 
        ?string $photoPath, 
        string $transactionDate
    ): int {
        $sql = "INSERT INTO transactions 
                (user_id, category_id, type, name, description, amount, photo_path, transaction_date, created_at, updated_at) 
                VALUES (:user_id, :category_id, :type, :name, :description, :amount, :photo_path, :transaction_date, NOW(), NOW())";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'user_id'          => $userId,
            'category_id'      => $categoryId,
            'type'             => $type,
            'name'             => trim($name),
            'description'      => $description ? trim($description) : null,
            'amount'           => $amount,
            'photo_path'       => $photoPath,
            'transaction_date' => $transactionDate,
        ]);

        return (int)$this->db->lastInsertId();
    }

    public function update(
        int $id,
        int $userId,
        string $type,
        string $name,
        ?string $description,
        float $amount,
        ?int $categoryId,
        ?string $photoPath,
        string $transactionDate
    ): bool {
        $sql = "UPDATE transactions 
                SET category_id = :category_id,
                    type = :type,
                    name = :name,
                    description = :description,
                    amount = :amount,
                    photo_path = :photo_path,
                    transaction_date = :transaction_date,
                    updated_at = NOW()
                WHERE id = :id AND user_id = :user_id";
        
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([
            'id'               => $id,
            'user_id'          => $userId,
            'category_id'      => $categoryId,
            'type'             => $type,
            'name'             => trim($name),
            'description'      => $description ? trim($description) : null,
            'amount'           => $amount,
            'photo_path'       => $photoPath,
            'transaction_date' => $transactionDate,
        ]);
    }

    public function delete(int $id, int $userId): bool {
        $sql = "DELETE FROM transactions WHERE id = :id AND user_id = :user_id";
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['id' => $id, 'user_id' => $userId]);
        return $stmt->rowCount() > 0;
    }
}
