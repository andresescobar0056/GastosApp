<?php
/**
 * Modelo de Metas de Ahorro (goals)
 */

require_once __DIR__ . '/../config/database.php';

class Goal {
    private PDO $db;

    public function __construct() {
        $this->db = Database::getConnection();
    }

    public static function calculateRank(float $percentage): array {
        $pct = (int)floor($percentage);

        $ranks = [
            ['id' => 'diamante',  'name' => 'Diamante',  'min' => 100, 'color' => '#FFFFFF'],
            ['id' => 'paladio',   'name' => 'Paladio',   'min' => 90,  'color' => '#EEF2FF'],
            ['id' => 'zafiro',    'name' => 'Zafiro',    'min' => 80,  'color' => '#60A5FA'],
            ['id' => 'rubi',      'name' => 'Rubí',      'min' => 70,  'color' => '#FB7185'],
            ['id' => 'bismuto',   'name' => 'Bismuto',   'min' => 60,  'color' => '#38BDF8'],
            ['id' => 'esmeralda', 'name' => 'Esmeralda', 'min' => 50,  'color' => '#10B981'],
            ['id' => 'amatista',  'name' => 'Amatista',  'min' => 40,  'color' => '#C084FC'],
            ['id' => 'hierro',    'name' => 'Hierro',    'min' => 30,  'color' => '#E2E8F0'],
            ['id' => 'bronce',    'name' => 'Bronce',    'min' => 20,  'color' => '#F59E0B'],
            ['id' => 'papel',     'name' => 'Papel',     'min' => 10,  'color' => '#94A3B8'],
        ];

        foreach ($ranks as $r) {
            if ($pct >= $r['min']) {
                return $r;
            }
        }

        return ['id' => 'base', 'name' => 'Iniciando', 'min' => 0, 'color' => '#64748B'];
    }

    public function getByUser(int $userId): array {
        $sql = "SELECT * FROM goals WHERE user_id = :user_id ORDER BY id DESC";
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['user_id' => $userId]);
        $goals = $stmt->fetchAll();

        foreach ($goals as &$g) {
            $target = (float)$g['target_amount'];
            $current = (float)$g['current_amount'];
            $pct = $target > 0 ? round(($current / $target) * 100, 2) : 0;
            $g['progress_percentage'] = $pct;
            $g['rank'] = self::calculateRank($pct);
        }

        return $goals;
    }

    public function getByIdAndUser(int $id, int $userId): ?array {
        $sql = "SELECT * FROM goals WHERE id = :id AND user_id = :user_id LIMIT 1";
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['id' => $id, 'user_id' => $userId]);
        $goal = $stmt->fetch();

        if ($goal) {
            $target = (float)$goal['target_amount'];
            $current = (float)$goal['current_amount'];
            $pct = $target > 0 ? round(($current / $target) * 100, 2) : 0;
            $goal['progress_percentage'] = $pct;
            $goal['rank'] = self::calculateRank($pct);
            return $goal;
        }

        return null;
    }

    public function create(
        int $userId, 
        string $name, 
        ?string $description, 
        float $targetAmount, 
        float $currentAmount = 0.0, 
        ?string $targetDate = null, 
        ?string $imagePath = null
    ): int {
        $sql = "INSERT INTO goals 
                (user_id, name, description, target_amount, current_amount, target_date, image_path, created_at, updated_at) 
                VALUES (:user_id, :name, :description, :target_amount, :current_amount, :target_date, :image_path, NOW(), NOW())";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'user_id'       => $userId,
            'name'          => trim($name),
            'description'   => $description ? trim($description) : null,
            'target_amount' => $targetAmount,
            'current_amount'=> max(0.0, $currentAmount),
            'target_date'   => $targetDate,
            'image_path'    => $imagePath
        ]);

        return (int)$this->db->lastInsertId();
    }

    public function update(
        int $id,
        int $userId,
        string $name,
        ?string $description,
        float $targetAmount,
        float $currentAmount,
        ?string $targetDate,
        ?string $imagePath
    ): bool {
        $sql = "UPDATE goals 
                SET name = :name,
                    description = :description,
                    target_amount = :target_amount,
                    current_amount = :current_amount,
                    target_date = :target_date,
                    image_path = :image_path,
                    updated_at = NOW()
                WHERE id = :id AND user_id = :user_id";
        
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([
            'id'            => $id,
            'user_id'       => $userId,
            'name'          => trim($name),
            'description'   => $description ? trim($description) : null,
            'target_amount' => $targetAmount,
            'current_amount'=> max(0.0, $currentAmount),
            'target_date'   => $targetDate,
            'image_path'    => $imagePath
        ]);
    }

    public function deposit(int $id, int $userId, float $amount): bool {
        $sql = "UPDATE goals 
                SET current_amount = current_amount + :amount,
                    updated_at = NOW()
                WHERE id = :id AND user_id = :user_id";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([
            'id'      => $id,
            'user_id' => $userId,
            'amount'  => max(0.0, $amount)
        ]);
    }

    public function delete(int $id, int $userId): bool {
        $sql = "DELETE FROM goals WHERE id = :id AND user_id = :user_id";
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['id' => $id, 'user_id' => $userId]);
        return $stmt->rowCount() > 0;
    }

    public function updateImage(int $id, int $userId, string $imagePath): bool {
        $stmt = $this->db->prepare(
            "UPDATE goals SET image_path = :image_path, updated_at = NOW() WHERE id = :id AND user_id = :user_id"
        );
        return $stmt->execute(['image_path' => $imagePath, 'id' => $id, 'user_id' => $userId]);
    }
}
