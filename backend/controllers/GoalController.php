<?php
/**
 * Controlador de Metas de Ahorro y Rangos
 */

require_once __DIR__ . '/../models/Goal.php';
require_once __DIR__ . '/../models/Transaction.php';
require_once __DIR__ . '/../models/Category.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../lib/ImageUploader.php';

class GoalController {
    private Goal $goalModel;

    public function __construct() {
        $this->goalModel = new Goal();
    }

    public function list(): void {
        $userId = requireAuth();
        jsonSuccess('Metas obtenidas.', ['goals' => $this->goalModel->getByUser($userId)]);
    }

    public function detail(): void {
        $userId = requireAuth();
        $goal = $this->findOwnedOrFail((int)($_GET['id'] ?? 0), $userId);
        jsonSuccess('Detalle de meta.', ['goal' => $goal]);
    }

    public function create(): void {
        $userId = requireAuth();
        $data = requestData();
        $input = $this->validateInput($data);

        $imagePath = ImageUploader::fromRequest('image', $data, 'image_base64', 'goal');

        try {
            $id = $this->goalModel->create(
                $userId, $input['name'], $input['description'], $input['target'],
                $input['current'], $input['target_date'], $imagePath
            );
        } catch (Throwable $e) {
            ImageUploader::delete($imagePath);
            throw $e;
        }

        jsonSuccess('Meta creada exitosamente.', ['goal' => $this->goalModel->getByIdAndUser($id, $userId)], 201);
    }

    public function update(): void {
        $userId = requireAuth();
        $data = requestData();

        $existing = $this->findOwnedOrFail((int)($data['id'] ?? $_GET['id'] ?? 0), $userId);
        $input = $this->validateInput($data);

        $imagePath = $existing['image_path'];
        $newImage = ImageUploader::fromRequest('image', $data, 'image_base64', 'goal');
        if ($newImage) {
            $imagePath = $newImage;
        } elseif (!empty($data['remove_image']) && $data['remove_image'] !== '0') {
            $imagePath = null;
        }

        try {
            $this->goalModel->update(
                (int)$existing['id'], $userId, $input['name'], $input['description'],
                $input['target'], $input['current'], $input['target_date'], $imagePath
            );
        } catch (Throwable $e) {
            ImageUploader::delete($newImage);
            throw $e;
        }

        if ($existing['image_path'] !== $imagePath) {
            ImageUploader::delete($existing['image_path']);
        }

        jsonSuccess('Meta actualizada.', ['goal' => $this->goalModel->getByIdAndUser((int)$existing['id'], $userId)]);
    }

    public function updateImage(): void {
        $userId = requireAuth();
        $existing = $this->findOwnedOrFail((int)($_GET['id'] ?? $_POST['id'] ?? 0), $userId);

        $imagePath = ImageUploader::fromRequest('image', requestData(), 'image_base64', 'goal');
        if (!$imagePath) {
            jsonError('No se recibió ninguna imagen (JPG, PNG o WEBP, máx. 5MB).', 400);
        }

        $this->goalModel->updateImage((int)$existing['id'], $userId, $imagePath);
        ImageUploader::delete($existing['image_path']);

        jsonSuccess('Imagen de la meta actualizada.', ['goal' => $this->goalModel->getByIdAndUser((int)$existing['id'], $userId)]);
    }

    /**
     * Abonar a una meta: el dinero sale del saldo disponible.
     * Se registra un movimiento de gasto ("Abono a meta: ...") y se suma a la meta,
     * todo en la misma transacción y con validación de saldo.
     */
    public function deposit(): void {
        $userId = requireAuth();
        $data = requestData();

        $id = (int)($data['id'] ?? $data['goal_id'] ?? 0);
        $amount = parseAmount($data['amount'] ?? null);
        if ($amount === null) {
            jsonError('El monto a abonar debe ser mayor a 0.', 400);
        }

        $transactionModel = new Transaction();
        $categoryModel = new Category();

        Database::withUserLock($userId, function () use ($id, $userId, $amount, $transactionModel, $categoryModel) {
            $goal = $this->goalModel->getByIdAndUser($id, $userId);
            if (!$goal) {
                throw new ApiException('Meta no encontrada o no pertenece a tu cuenta.', 404);
            }

            $balance = $transactionModel->getBalance($userId);
            if ($amount > $balance) {
                throw new ApiException(
                    'Saldo insuficiente para abonar. Saldo disponible: $' . number_format($balance, 0, ',', '.'),
                    400,
                    ['available_balance' => $balance]
                );
            }

            $category = $categoryModel->findByName('Ahorro', $userId);
            $categoryId = $category ? (int)$category['id'] : $categoryModel->create('Ahorro', $userId);

            $transactionModel->create(
                $userId, 'expense', mb_substr('Abono a meta: ' . $goal['name'], 0, 150),
                null, $amount, $categoryId, null, date('Y-m-d')
            );
            $this->goalModel->deposit($id, $userId, $amount);
        });

        jsonSuccess('Abono registrado a la meta.', ['goal' => $this->goalModel->getByIdAndUser($id, $userId)]);
    }

    public function delete(): void {
        $userId = requireAuth();
        $data = requestData();
        $existing = $this->findOwnedOrFail((int)($data['id'] ?? $_GET['id'] ?? 0), $userId);

        $this->goalModel->delete((int)$existing['id'], $userId);
        ImageUploader::delete($existing['image_path']);

        jsonSuccess('Meta eliminada correctamente.', ['deleted_id' => (int)$existing['id']]);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private function findOwnedOrFail(int $id, int $userId): array {
        if ($id <= 0) {
            jsonError('ID de meta no válido.', 400);
        }
        $goal = $this->goalModel->getByIdAndUser($id, $userId);
        if (!$goal) {
            jsonError('Meta no encontrada o no pertenece a tu cuenta.', 404);
        }
        return $goal;
    }

    private function validateInput(array $data): array {
        $name = limitText($data['name'] ?? '', 150);
        if ($name === '') {
            jsonError('El nombre de la meta es requerido.', 400);
        }

        $target = parseAmount($data['target_amount'] ?? null);
        if ($target === null) {
            jsonError('El monto objetivo debe ser mayor a 0.', 400);
        }

        $current = parseAmount($data['saved_amount'] ?? $data['current_amount'] ?? 0, true);
        if ($current === null) {
            jsonError('El monto ahorrado no puede ser negativo.', 400);
        }

        $targetDate = trim((string)($data['target_date'] ?? ''));
        if ($targetDate === '') {
            $targetDate = null;
        } elseif (!isValidDate($targetDate)) {
            jsonError('La fecha objetivo no es válida (formato AAAA-MM-DD).', 400);
        }

        return [
            'name'        => $name,
            'description' => limitText($data['description'] ?? '', 2000),
            'target'      => $target,
            'current'     => $current,
            'target_date' => $targetDate,
        ];
    }
}
