<?php
/**
 * Controlador de Autenticación (Registro, Login, Logout y Sesión)
 */

require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../config/response.php';

class AuthController {
    private User $userModel;

    public function __construct() {
        $this->userModel = new User();
    }

    public function register(): void {
        startSecureSession();

        $data = json_decode(file_get_contents('php://input'), true) ?? $_POST;

        $username = trim($data['username'] ?? '');
        $email    = strtolower(trim($data['email'] ?? ''));
        $password = $data['password'] ?? '';
        $confirm  = $data['confirm_password'] ?? '';

        if (empty($username) || empty($email) || empty($password)) {
            jsonError('Todos los campos son obligatorios.', 400);
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            jsonError('El formato de correo electrónico no es válido.', 400);
        }

        if (strlen($password) < 6) {
            jsonError('La contraseña debe tener al menos 6 caracteres.', 400);
        }

        if ($password !== $confirm) {
            jsonError('Las contraseñas no coinciden.', 400);
        }

        if ($this->userModel->findByEmail($email)) {
            jsonError('El correo electrónico ya se encuentra registrado.', 409);
        }

        $userId = $this->userModel->create($username, $email, $password);

        session_regenerate_id(true);
        $_SESSION['user_id'] = $userId;

        $user = $this->userModel->findById($userId);

        jsonSuccess('Registro exitoso.', [
            'user' => $this->formatUser($user)
        ], 201);
    }

    public function login(): void {
        startSecureSession();

        $data = json_decode(file_get_contents('php://input'), true) ?? $_POST;

        $loginInput = trim($data['username_or_email'] ?? $data['username'] ?? '');
        $password   = $data['password'] ?? '';

        if (empty($loginInput) || empty($password)) {
            jsonError('Por favor ingresa usuario/correo y contraseña.', 400);
        }

        // Buscar por email o por username
        $user = filter_var($loginInput, FILTER_VALIDATE_EMAIL)
            ? $this->userModel->findByEmail($loginInput)
            : $this->userModel->findByUsername($loginInput);

        if (!$user) {
            jsonError('Credenciales incorrectas.', 401);
        }

        if ($user['status'] !== 'active') {
            jsonError('La cuenta de usuario se encuentra inactiva o suspendida.', 403);
        }

        if (!$this->userModel->verifyPassword($password, $user['password'])) {
            jsonError('Credenciales incorrectas.', 401);
        }

        // Regenerar ID de sesión para prevenir Session Fixation
        session_regenerate_id(true);
        $_SESSION['user_id'] = (int)$user['id'];

        jsonSuccess('Inicio de sesión exitoso.', [
            'user' => $this->formatUser($user)
        ]);
    }

    public function me(): void {
        $userId = getCurrentUserId();
        if (!$userId) {
            jsonError('Sesión no iniciada.', 401);
        }

        $user = $this->userModel->findById($userId);
        if (!$user) {
            jsonError('Usuario no encontrado.', 404);
        }

        jsonSuccess('Usuario autenticado.', [
            'user' => $this->formatUser($user)
        ]);
    }

    public function updateAvatar(): void {
        $userId = requireAuth();

        $avatarPath = null;

        // Prioridad 1: archivo multipart (File object desde FormData)
        if (!empty($_FILES['avatar']) && $_FILES['avatar']['error'] === UPLOAD_ERR_OK) {
            $avatarPath = $this->handleAvatarUpload($_FILES['avatar']);
        }
        // Prioridad 2: base64 en JSON body
        elseif (!empty(file_get_contents('php://input'))) {
            $data = json_decode(file_get_contents('php://input'), true);
            if (!empty($data['avatar_base64'])) {
                $avatarPath = $this->handleBase64Avatar($data['avatar_base64']);
            }
        }

        if (!$avatarPath) {
            jsonError('No se pudo procesar la imagen. Verifica el formato (JPG, PNG o WEBP, máx. 5MB).', 400);
        }

        $this->userModel->updateAvatar($userId, $avatarPath);

        $user = $this->userModel->findById($userId);
        jsonSuccess('Foto de perfil actualizada.', [
            'user' => $this->formatUser($user)
        ]);
    }

    public function logout(): void {
        startSecureSession();
        $_SESSION = [];
        if (ini_get("session.use_cookies")) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000,
                $params["path"], $params["domain"],
                $params["secure"], $params["httponly"]
            );
        }
        session_destroy();

        jsonSuccess('Sesión cerrada correctamente.');
    }

    // ── Helpers privados ────────────────────────────────────────────────────

    /** Formato estándar del usuario para todas las respuestas */
    private function formatUser(array $user): array {
        return [
            'id'          => (int)$user['id'],
            'username'    => $user['username'],
            'email'       => $user['email'],
            'tag'         => 'USR-' . $user['id'],
            'avatar_path' => $user['avatar_path'] ?? null,
        ];
    }

    /** Guarda un archivo subido como avatar y retorna el path relativo */
    private function handleAvatarUpload(array $file): ?string {
        $maxBytes = 5 * 1024 * 1024;
        if ($file['size'] > $maxBytes) {
            jsonError('La imagen excede el límite máximo de 5MB.', 400);
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
        $filename  = 'avatar_' . bin2hex(random_bytes(16)) . '.' . $ext;
        $uploadDir = __DIR__ . '/../uploads/';

        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        if (move_uploaded_file($file['tmp_name'], $uploadDir . $filename)) {
            return 'backend/uploads/' . $filename;
        }

        return null;
    }

    /** Decodifica una imagen base64 y la guarda como avatar */
    private function handleBase64Avatar(string $base64): ?string {
        if (!preg_match('/^data:image\/(\w+);base64,/', $base64, $matches)) {
            return null;
        }

        $ext = strtolower($matches[1]);
        if ($ext === 'jpeg') $ext = 'jpg';
        if (!in_array($ext, ['jpg', 'png', 'webp'])) return null;

        $decoded = base64_decode(substr($base64, strpos($base64, ',') + 1));
        if (!$decoded) return null;

        $filename  = 'avatar_' . bin2hex(random_bytes(16)) . '.' . $ext;
        $uploadDir = __DIR__ . '/../uploads/';

        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        file_put_contents($uploadDir . $filename, $decoded);
        return 'backend/uploads/' . $filename;
    }
}
