<?php
/**
 * Controlador de Metas de Ahorro y Rangos
 */

require_once __DIR__ . '/../models/Goal.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../config/response.php';

class GoalController {
    private Goal $goalModel;

    public function __construct() {
        $this->goalModel = new Goal();
    }

    public function list(): void {
        $userId = requireAuth();
        $goals = $this->goalModel->getByUser($userId);

        jsonSuccess('Metas obtenidas.', ['goals' => $goals]);
    }

    public function detail(): void {
        $userId = requireAuth();
        $id = (int)($_GET['id'] ?? 0);

        if ($id <= 0) {
            jsonError('ID de meta no válido.', 400);
        }

        $goal = $this->goalModel->getByIdAndUser($id, $userId);
        if (!$goal) {
            jsonError('Meta no encontrada o no pertenece a tu cuenta.', 404);
        }

        jsonSuccess('Detalle de meta.', ['goal' => $goal]);
    }

    public function create(): void {
        $userId = requireAuth();

        // Soporta multipart/form-data (con imagen) y JSON (sin imagen)
        $data = !empty($_POST) ? $_POST : (json_decode(file_get_contents('php://input'), true) ?? []);

        $name          = trim($data['name'] ?? '');
        $description   = trim($data['description'] ?? '');
        $targetAmount  = (float)($data['target_amount'] ?? 0);
        $currentAmount = (float)($data['saved_amount'] ?? $data['current_amount'] ?? 0);
        $targetDate    = !empty($data['target_date']) ? trim($data['target_date']) : null;

        if (empty($name)) {
            jsonError('El nombre de la meta es requerido.', 400);
        }

        if ($targetAmount <= 0) {
            jsonError('El monto objetivo debe ser mayor a 0.', 400);
        }

        if ($currentAmount < 0) {
            jsonError('El monto ahorrado inicial no puede ser negativo.', 400);
        }

        // Procesar imagen si se envió
        $imagePath = null;
        if (!empty($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
            $imagePath = $this->handleImageUpload($_FILES['image']);
        } elseif (!empty($data['image_base64'])) {
            $imagePath = $this->handleBase64Image($data['image_base64']);
        }

        $id = $this->goalModel->create(
            $userId,
            $name,
            $description,
            $targetAmount,
            $currentAmount,
            $targetDate,
            $imagePath
        );

        $created = $this->goalModel->getByIdAndUser($id, $userId);
        jsonSuccess('Meta creada exitosamente.', ['goal' => $created], 201);
    }

    public function update(): void {
        $userId = requireAuth();

        // Soporta multipart/form-data (con imagen) y JSON (sin imagen)
        $data = !empty($_POST) ? $_POST : (json_decode(file_get_contents('php://input'), true) ?? []);

        $id            = (int)($data['id'] ?? $_GET['id'] ?? 0);
        $name          = trim($data['name'] ?? '');
        $description   = trim($data['description'] ?? '');
        $targetAmount  = (float)($data['target_amount'] ?? 0);
        $currentAmount = (float)($data['saved_amount'] ?? $data['current_amount'] ?? 0);
        $targetDate    = !empty($data['target_date']) ? trim($data['target_date']) : null;

        if ($id <= 0) {
            jsonError('ID de meta no válido.', 400);
        }

        $existing = $this->goalModel->getByIdAndUser($id, $userId);
        if (!$existing) {
            jsonError('Meta no encontrada o no pertenece a tu cuenta.', 404);
        }

        if ($targetAmount <= 0) {
            jsonError('El monto objetivo debe ser mayor a 0.', 400);
        }

        if ($currentAmount < 0) {
            jsonError('El monto ahorrado no puede ser negativo.', 400);
        }

        // Procesar nueva imagen si se envió; si no, conservar la existente
        $imagePath = $existing['image_path'];
        if (!empty($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
            $newPath = $this->handleImageUpload($_FILES['image']);
            if ($newPath) {
                $this->deleteOldFile($existing['image_path']);
                $imagePath = $newPath;
            }
        } elseif (!empty($data['image_base64'])) {
            $newPath = $this->handleBase64Image($data['image_base64']);
            if ($newPath) {
                $this->deleteOldFile($existing['image_path']);
                $imagePath = $newPath;
            }
        } elseif (isset($data['remove_image']) && $data['remove_image'] == '1') {
            $this->deleteOldFile($existing['image_path']);
            $imagePath = null;
        }

        $this->goalModel->update(
            $id,
            $userId,
            $name ?: $existing['name'],
            $description,
            $targetAmount,
            $currentAmount,
            $targetDate,
            $imagePath
        );

        $updated = $this->goalModel->getByIdAndUser($id, $userId);
        jsonSuccess('Meta actualizada.', ['goal' => $updated]);
    }

    public function updateImage(): void {
        $userId = requireAuth();

        $id = (int)($_GET['id'] ?? $_POST['id'] ?? 0);
        if ($id <= 0) {
            jsonError('ID de meta no válido.', 400);
        }

        $existing = $this->goalModel->getByIdAndUser($id, $userId);
        if (!$existing) {
            jsonError('Meta no encontrada o no pertenece a tu cuenta.', 404);
        }

        $imagePath = null;

        if (!empty($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
            $imagePath = $this->handleImageUpload($_FILES['image']);
        } else {
            $data = json_decode(file_get_contents('php://input'), true) ?? [];
            if (!empty($data['image_base64'])) {
                $imagePath = $this->handleBase64Image($data['image_base64']);
            }
        }

        if (!$imagePath) {
            jsonError('No se pudo procesar la imagen. Verifica formato (JPG, PNG, WEBP) y tamaño (máx. 5MB).', 400);
        }

        // Borrar imagen anterior si existe
        $this->deleteOldFile($existing['image_path']);

        $this->goalModel->updateImage($id, $userId, $imagePath);

        $updated = $this->goalModel->getByIdAndUser($id, $userId);
        jsonSuccess('Imagen de la meta actualizada.', ['goal' => $updated]);
    }

    public function deposit(): void {
        $userId = requireAuth();
        $data = json_decode(file_get_contents('php://input'), true) ?? $_POST;

        $id     = (int)($data['id'] ?? $data['goal_id'] ?? 0);
        $amount = (float)($data['amount'] ?? 0);

        if ($id <= 0) {
            jsonError('ID de meta no válido.', 400);
        }

        if ($amount <= 0) {
            jsonError('El monto a abonar debe ser mayor a 0.', 400);
        }

        $existing = $this->goalModel->getByIdAndUser($id, $userId);
        if (!$existing) {
            jsonError('Meta no encontrada o no pertenece a tu cuenta.', 404);
        }

        $this->goalModel->deposit($id, $userId, $amount);

        $updated = $this->goalModel->getByIdAndUser($id, $userId);
        jsonSuccess('Abono registrado a la meta.', ['goal' => $updated]);
    }

    public function delete(): void {
        $userId = requireAuth();
        $data = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $id = (int)($data['id'] ?? $_GET['id'] ?? 0);

        if ($id <= 0) {
            jsonError('ID de meta no válido.', 400);
        }

        $existing = $this->goalModel->getByIdAndUser($id, $userId);
        if (!$existing) {
            jsonError('Meta no encontrada o no pertenece a tu cuenta.', 404);
        }

        // Borrar imagen física si existe
        $this->deleteOldFile($existing['image_path']);

        $this->goalModel->delete($id, $userId);
        jsonSuccess('Meta eliminada correctamente.', ['deleted_id' => $id]);
    }

    // ── Helpers privados ────────────────────────────────────────────────────

    /** Sube un archivo de imagen y retorna su path relativo */
    private function handleImageUpload(array $file): ?string {
        $maxBytes = 5 * 1024 * 1024;
        if ($file['size'] > $maxBytes) {
            jsonError('La imagen excede el límite de 5MB.', 400);
        }

        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime  = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);

        $allowedMimes = [
            'image/jpeg' => 'jpg',
            'image/png'  => 'png',
            'image/webp' => 'webp',
        ];

        if (!array_key_exists($mime, $allowedMimes)) {
            jsonError('Formato no permitido. Solo JPG, PNG o WEBP.', 400);
        }

        $ext       = $allowedMimes[$mime];
        $filename  = 'goal_' . bin2hex(random_bytes(16)) . '.' . $ext;
        $uploadDir = __DIR__ . '/../uploads/';

        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        if (move_uploaded_file($file['tmp_name'], $uploadDir . $filename)) {
            return 'backend/uploads/' . $filename;
        }

        return null;
    }

    /** Decodifica una imagen base64 y la guarda */
    private function handleBase64Image(string $base64): ?string {
        if (!preg_match('/^data:image\/(\w+);base64,/', $base64, $matches)) {
            return null;
        }

        $ext = strtolower($matches[1]);
        if ($ext === 'jpeg') $ext = 'jpg';
        if (!in_array($ext, ['jpg', 'png', 'webp'])) return null;

        $decoded = base64_decode(substr($base64, strpos($base64, ',') + 1));
        if (!$decoded) return null;

        $filename  = 'goal_' . bin2hex(random_bytes(16)) . '.' . $ext;
        $uploadDir = __DIR__ . '/../uploads/';

        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        file_put_contents($uploadDir . $filename, $decoded);
        return 'backend/uploads/' . $filename;
    }

    /** Elimina un archivo físico del servidor si existe */
    private function deleteOldFile(?string $relativePath): void {
        if (!$relativePath) return;
        // El path está guardado como 'backend/uploads/xxx.jpg'
        // Necesitamos la ruta absoluta desde la raíz del proyecto
        $absolute = __DIR__ . '/../../' . $relativePath;
        if (file_exists($absolute)) {
            @unlink($absolute);
        }
    }
}
