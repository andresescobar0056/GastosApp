<?php
/**
 * Controlador de Transacciones y Movimientos
 *
 * Toda operación que cambia el saldo se ejecuta con Database::withUserLock(),
 * de modo que la validación "el saldo nunca queda negativo" es atómica.
 */

require_once __DIR__ . '/../models/Transaction.php';
require_once __DIR__ . '/../models/Category.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../lib/ImageUploader.php';

class TransactionController {
    private Transaction $transactionModel;
    private Category $categoryModel;

    public function __construct() {
        $this->transactionModel = new Transaction();
        $this->categoryModel = new Category();
    }

    public function list(): void {
        $userId = requireAuth();

        $type   = $_GET['type'] ?? null;
        $search = isset($_GET['search']) ? limitText($_GET['search'], 100) : null;

        jsonSuccess('Movimientos obtenidos.', [
            'movements' => $this->transactionModel->getByUser($userId, $type, $search),
            'balance'   => $this->transactionModel->getBalance($userId),
            'totals'    => $this->transactionModel->getTotals($userId),
        ]);
    }

    public function detail(): void {
        $userId = requireAuth();
        $id = (int)($_GET['id'] ?? 0);

        if ($id <= 0) {
            jsonError('ID de movimiento no válido.', 400);
        }

        $movement = $this->transactionModel->getByIdAndUser($id, $userId);
        if (!$movement) {
            jsonError('Movimiento no encontrado o no pertenece a tu cuenta.', 404);
        }

        jsonSuccess('Detalle de movimiento.', ['movement' => $movement]);
    }

    public function create(): void {
        $userId = requireAuth();
        $data = requestData();
        $input = $this->validateInput($data);

        // La foto se guarda antes de la transacción; si algo falla se borra.
        $photoPath = ImageUploader::fromRequest('photo', $data, 'photo_base64', 'mov');

        try {
            $result = Database::withUserLock($userId, function () use ($userId, $input, $photoPath) {
                $currentBalance = $this->transactionModel->getBalance($userId);
                $newBalance = $currentBalance + self::effect($input['type'], $input['amount']);
                $this->assertNonNegative($newBalance, $currentBalance);

                $categoryId = $this->resolveCategory($input['category'], $userId);

                $id = $this->transactionModel->create(
                    $userId, $input['type'], $input['name'], $input['description'],
                    $input['amount'], $categoryId, $photoPath, $input['date']
                );

                return ['id' => $id, 'old' => $currentBalance, 'new' => $newBalance];
            });
        } catch (Throwable $e) {
            ImageUploader::delete($photoPath);
            throw $e;
        }

        jsonSuccess('Movimiento registrado exitosamente.', [
            'movement'     => $this->transactionModel->getByIdAndUser($result['id'], $userId),
            'old_balance'  => $result['old'],
            'new_balance'  => $result['new'],
            'delta_amount' => $input['amount'],
            'type'         => $input['type'],
        ], 201);
    }

    public function update(): void {
        $userId = requireAuth();
        $data = requestData();

        $id = (int)($data['id'] ?? $_GET['id'] ?? 0);
        if ($id <= 0) {
            jsonError('ID de movimiento no válido.', 400);
        }

        $input = $this->validateInput($data);
        $newPhoto = ImageUploader::fromRequest('photo', $data, 'photo_base64', 'mov');
        $removePhoto = !empty($data['remove_photo']) && $data['remove_photo'] !== '0';

        try {
            $result = Database::withUserLock($userId, function () use ($id, $userId, $input, $newPhoto, $removePhoto) {
                $existing = $this->transactionModel->getByIdAndUser($id, $userId);
                if (!$existing) {
                    throw new ApiException('Movimiento no encontrado o no pertenece a tu cuenta.', 404);
                }

                // Saldo resultante = saldo actual - efecto del movimiento viejo + efecto del nuevo
                $currentBalance = $this->transactionModel->getBalance($userId);
                $newBalance = $currentBalance
                    - self::effect($existing['type'], (float)$existing['amount'])
                    + self::effect($input['type'], $input['amount']);
                $this->assertNonNegative($newBalance, $currentBalance);

                $categoryId = $this->resolveCategory($input['category'], $userId);

                // Foto: nueva > quitar > conservar la existente
                $photoPath = $newPhoto ?? ($removePhoto ? null : $existing['photo_path']);

                $this->transactionModel->update(
                    $id, $userId, $input['type'], $input['name'], $input['description'],
                    $input['amount'], $categoryId, $photoPath, $input['date']
                );

                return ['new' => $newBalance, 'old_photo' => $existing['photo_path'], 'photo' => $photoPath];
            });
        } catch (Throwable $e) {
            ImageUploader::delete($newPhoto);
            throw $e;
        }

        if ($result['old_photo'] && $result['old_photo'] !== $result['photo']) {
            ImageUploader::delete($result['old_photo']);
        }

        jsonSuccess('Movimiento actualizado.', [
            'movement'    => $this->transactionModel->getByIdAndUser($id, $userId),
            'new_balance' => $result['new'],
        ]);
    }

    public function delete(): void {
        $userId = requireAuth();
        $data = requestData();
        $id = (int)($data['id'] ?? $_GET['id'] ?? 0);

        if ($id <= 0) {
            jsonError('ID de movimiento no válido.', 400);
        }

        $result = Database::withUserLock($userId, function () use ($id, $userId) {
            $existing = $this->transactionModel->getByIdAndUser($id, $userId);
            if (!$existing) {
                throw new ApiException('Movimiento no encontrado o no pertenece a tu cuenta.', 404);
            }

            // Borrar un ingreso no puede dejar el saldo en negativo
            $currentBalance = $this->transactionModel->getBalance($userId);
            $newBalance = $currentBalance - self::effect($existing['type'], (float)$existing['amount']);
            if ($newBalance < 0) {
                throw new ApiException(
                    'No puedes eliminar este ingreso: el saldo quedaría en negativo. Elimina antes los gastos que dependen de él.',
                    400
                );
            }

            $this->transactionModel->delete($id, $userId);
            return ['new' => $newBalance, 'photo' => $existing['photo_path']];
        });

        ImageUploader::delete($result['photo']);

        jsonSuccess('Movimiento eliminado correctamente.', [
            'deleted_id'  => $id,
            'new_balance' => $result['new'],
        ]);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    /** Efecto de un movimiento sobre el saldo: +monto si es ingreso, -monto si es gasto. */
    public static function effect(string $type, float $amount): float {
        return $type === 'income' ? $amount : -$amount;
    }

    private function assertNonNegative(float $newBalance, float $currentBalance): void {
        if (round($newBalance, 2) < 0) {
            throw new ApiException(
                'Saldo insuficiente para esta operación. Saldo disponible: $' . number_format($currentBalance, 0, ',', '.'),
                400,
                ['available_balance' => $currentBalance]
            );
        }
    }

    /** Valida y normaliza los campos comunes de crear/editar. Responde 400 si algo es inválido. */
    private function validateInput(array $data): array {
        $type = trim((string)($data['type'] ?? ''));
        if ($type !== 'income' && $type !== 'expense') {
            jsonError('Tipo de movimiento inválido. Debe ser ingreso (income) o retiro (expense).', 400);
        }

        $name = limitText($data['name'] ?? '', 150);
        if ($name === '') {
            jsonError('El concepto o nombre es requerido.', 400);
        }

        $amount = parseAmount($data['amount'] ?? null);
        if ($amount === null) {
            jsonError('El monto debe ser un número positivo mayor a 0.', 400);
        }

        $date = trim((string)($data['date'] ?? ''));
        if ($date === '') {
            $date = date('Y-m-d');
        } elseif (!isValidDate($date)) {
            jsonError('La fecha no es válida (formato AAAA-MM-DD).', 400);
        }

        return [
            'type'        => $type,
            'name'        => $name,
            'amount'      => $amount,
            'date'        => $date,
            'description' => limitText($data['description'] ?? '', 2000),
            'category'    => limitText($data['category'] ?? 'General', 80) ?: 'General',
        ];
    }

    private function resolveCategory(string $categoryName, int $userId): int {
        $category = $this->categoryModel->findByName($categoryName, $userId);
        return $category ? (int)$category['id'] : $this->categoryModel->create($categoryName, $userId);
    }
}
