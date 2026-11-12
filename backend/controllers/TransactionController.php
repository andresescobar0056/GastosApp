<?php
/**
 * Controlador de Transacciones y Movimientos
 */

require_once __DIR__ . '/../models/Transaction.php';
require_once __DIR__ . '/../models/Category.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../config/response.php';

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
        $search = $_GET['search'] ?? null;

        $movements = $this->transactionModel->getByUser($userId, $type, $search);
        $balance   = $this->transactionModel->getBalance($userId);
        $totals    = $this->transactionModel->getTotals($userId);

        jsonSuccess('Movimientos obtenidos.', [
            'movements' => $movements,
            'balance'   => $balance,
            'totals'    => $totals
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

        // Soporta tanto JSON como multipart/form-data
        $data = !empty($_POST) ? $_POST : (json_decode(file_get_contents('php://input'), true) ?? []);

        $type        = trim($data['type'] ?? '');
        $name        = trim($data['name'] ?? '');
        $description = trim($data['description'] ?? '');
        $amount      = (float)($data['amount'] ?? 0);
        $categoryName= trim($data['category'] ?? 'General');
        $date        = trim($data['date'] ?? date('Y-m-d'));

        if ($type !== 'income' && $type !== 'expense') {
            jsonError('Tipo de movimiento inválido. Debe ser ingreso (income) o retiro (expense).', 400);
        }

        if (empty($name)) {
            jsonError('El concepto o nombre es requerido.', 400);
        }

        if ($amount <= 0) {
            jsonError('El monto debe ser un valor positivo mayor a 0.', 400);
        }

        // VALIDACIÓN DE SALDO EN SERVIDOR PARA RETIROS
        $currentBalance = $this->transactionModel->getBalance($userId);
        if ($type === 'expense') {
            if ($amount > $currentBalance) {
                jsonError(
                    'Saldo insuficiente para realizar este retiro. Saldo disponible: $' . number_format($currentBalance, 0, ',', '.'),
                    400,
                    ['available_balance' => $currentBalance]
                );
            }
        }

        // Resolver ID de categoría
        $category = $this->categoryModel->findByName($categoryName, $userId);
        $categoryId = $category ? (int)$category['id'] : null;
        if (!$categoryId && !empty($categoryName)) {
            $categoryId = $this->categoryModel->create($categoryName, $userId);
        }

        // Manejo seguro de fotografía
        $photoPath = $this->handlePhotoUpload($_FILES['photo'] ?? null);

        // Si se envió foto en base64 (fallback)
        if (!$photoPath && !empty($data['photo_base64'])) {
            $photoPath = $this->handleBase64Photo($data['photo_base64']);
        }

        $id = $this->transactionModel->create(
            $userId,
            $type,
            $name,
            $description,
            $amount,
            $categoryId,
            $photoPath,
            $date
        );

        $newBalance = $this->transactionModel->getBalance($userId);
        $createdMovement = $this->transactionModel->getByIdAndUser($id, $userId);

        jsonSuccess('Movimiento registrado exitosamente.', [
            'movement'     => $createdMovement,
            'old_balance'  => $currentBalance,
            'new_balance'  => $newBalance,
            'delta_amount' => $amount,
            'type'         => $type
        ], 201);
    }

    public function update(): void {
        $userId = requireAuth();

        $data = !empty($_POST) ? $_POST : (json_decode(file_get_contents('php://input'), true) ?? []);

        $id          = (int)($data['id'] ?? $_GET['id'] ?? 0);
        $type        = trim($data['type'] ?? '');
        $name        = trim($data['name'] ?? '');
        $description = trim($data['description'] ?? '');
        $amount      = (float)($data['amount'] ?? 0);
        $categoryName= trim($data['category'] ?? '');
        $date        = trim($data['date'] ?? date('Y-m-d'));

        if ($id <= 0) {
            jsonError('ID de movimiento no válido.', 400);
        }

        $existing = $this->transactionModel->getByIdAndUser($id, $userId);
        if (!$existing) {
            jsonError('Movimiento no encontrado o no pertenece a tu cuenta.', 404);
        }

        if ($amount <= 0) {
            jsonError('El monto debe ser un valor positivo mayor a 0.', 400);
        }

        // Resolver categoría
        $categoryId = $existing['category_id'];
        if (!empty($categoryName)) {
            $category = $this->categoryModel->findByName($categoryName, $userId);
            $categoryId = $category ? (int)$category['id'] : $this->categoryModel->create($categoryName, $userId);
        }

        // Manejo de foto nueva o conservar anterior
        $photoPath = $this->handlePhotoUpload($_FILES['photo'] ?? null);
        if (!$photoPath && isset($data['photo_path'])) {
            $photoPath = $data['photo_path'];
        } elseif (!$photoPath && !empty($data['photo_base64'])) {
            $photoPath = $this->handleBase64Photo($data['photo_base64']);
        } elseif (!$photoPath && !isset($data['remove_photo'])) {
            $photoPath = $existing['photo_path'];
        }

        $this->transactionModel->update(
            $id,
            $userId,
            $type ?: $existing['type'],
            $name ?: $existing['name'],
            $description,
            $amount,
            $categoryId,
            $photoPath,
            $date
        );

        $updatedMovement = $this->transactionModel->getByIdAndUser($id, $userId);
        $newBalance = $this->transactionModel->getBalance($userId);

        jsonSuccess('Movimiento actualizado.', [
            'movement'    => $updatedMovement,
            'new_balance' => $newBalance
        ]);
    }

    public function delete(): void {
        $userId = requireAuth();

        $data = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $id = (int)($data['id'] ?? $_GET['id'] ?? 0);

        if ($id <= 0) {
            jsonError('ID de movimiento no válido.', 400);
        }

        $existing = $this->transactionModel->getByIdAndUser($id, $userId);
        if (!$existing) {
            jsonError('Movimiento no encontrado o no pertenece a tu cuenta.', 404);
        }

        $this->transactionModel->delete($id, $userId);
        $newBalance = $this->transactionModel->getBalance($userId);

        jsonSuccess('Movimiento eliminado correctamente.', [
            'deleted_id'  => $id,
            'new_balance' => $newBalance
        ]);
    }

    private function handlePhotoUpload(?array $file): ?string {
        if (!$file || !isset($file['error']) || $file['error'] !== UPLOAD_ERR_OK) {
            return null;
        }

        // Límite de tamaño: 5MB
        $maxBytes = 5 * 1024 * 1024;
        if ($file['size'] > $maxBytes) {
            jsonError('La imagen excede el límite máximo de 5MB.', 400);
        }

        // Validación estricta de tipo MIME real
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);

        $allowedMimes = [
            'image/jpeg' => 'jpg',
            'image/png'  => 'png',
            'image/webp' => 'webp'
        ];

        if (!array_key_exists($mime, $allowedMimes)) {
            jsonError('Formato de imagen no permitido. Solo JPG, PNG o WEBP.', 400);
        }

        $ext = $allowedMimes[$mime];
        $filename = bin2hex(random_bytes(16)) . '.' . $ext;
        $uploadDir = __DIR__ . '/../uploads/';

        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        $targetPath = $uploadDir . $filename;
        if (move_uploaded_file($file['tmp_name'], $targetPath)) {
            return 'backend/uploads/' . $filename;
        }

        return null;
    }

    private function handleBase64Photo(string $base64): ?string {
        if (preg_match('/^data:image\/(\w+);base64,/', $base64, $matches)) {
            $ext = strtolower($matches[1]);
            if ($ext === 'jpeg') $ext = 'jpg';
            if (!in_array($ext, ['jpg', 'png', 'webp'])) return null;

            $data = substr($base64, strpos($base64, ',') + 1);
            $decoded = base64_decode($data);
            if (!$decoded) return null;

            $filename = bin2hex(random_bytes(16)) . '.' . $ext;
            $uploadDir = __DIR__ . '/../uploads/';
            if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

            file_put_contents($uploadDir . $filename, $decoded);
            return 'backend/uploads/' . $filename;
        }
        return null;
    }
}
