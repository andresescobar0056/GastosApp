<?php
/**
 * Controlador de Autenticación (Registro, Login, Logout, Sesión y Avatar)
 */

require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../lib/ImageUploader.php';

class AuthController {
    private const MIN_PASSWORD     = 8;
    private const MAX_ATTEMPTS_ID  = 5;   // por usuario/correo
    private const MAX_ATTEMPTS_IP  = 20;  // por IP
    private const LOCK_MINUTES     = 15;

    private User $userModel;

    public function __construct() {
        $this->userModel = new User();
    }

    public function register(): void {
        startSecureSession();
        $data = requestData();

        $username = trim((string)($data['username'] ?? ''));
        $email    = strtolower(trim((string)($data['email'] ?? '')));
        $password = (string)($data['password'] ?? '');
        $confirm  = (string)($data['confirm_password'] ?? '');

        if ($username === '' || $email === '' || $password === '') {
            jsonError('Todos los campos son obligatorios.', 400);
        }

        if (!preg_match('/^[\p{L}\p{N}_.\-]{3,30}$/u', $username)) {
            jsonError('El usuario debe tener entre 3 y 30 caracteres (letras, números, punto, guion o guion bajo).', 400);
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 150) {
            jsonError('El formato de correo electrónico no es válido.', 400);
        }

        if (strlen($password) < self::MIN_PASSWORD) {
            jsonError('La contraseña debe tener al menos ' . self::MIN_PASSWORD . ' caracteres.', 400);
        }

        if (strlen($password) > 72) {
            jsonError('La contraseña no puede superar 72 caracteres.', 400);
        }

        if ($password !== $confirm) {
            jsonError('Las contraseñas no coinciden.', 400);
        }

        if ($this->userModel->findByEmail($email)) {
            jsonError('El correo electrónico ya se encuentra registrado.', 409);
        }

        if ($this->userModel->findByUsername($username)) {
            jsonError('Ese nombre de usuario ya está en uso.', 409);
        }

        try {
            $userId = $this->userModel->create($username, $email, $password);
        } catch (PDOException $e) {
            // Carrera entre dos registros simultáneos con el mismo usuario/correo
            if ($e->getCode() === '23000') {
                jsonError('El usuario o correo ya están registrados.', 409);
            }
            throw $e;
        }

        session_regenerate_id(true);
        $_SESSION['user_id'] = $userId;

        jsonSuccess('Registro exitoso.', [
            'user' => $this->formatUser($this->userModel->findById($userId))
        ], 201);
    }

    public function login(): void {
        startSecureSession();
        $data = requestData();

        $loginInput = trim((string)($data['username_or_email'] ?? $data['username'] ?? ''));
        $password   = (string)($data['password'] ?? '');

        if ($loginInput === '' || $password === '') {
            jsonError('Por favor ingresa usuario/correo y contraseña.', 400);
        }

        $ip         = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $identifier = mb_strtolower(mb_substr($loginInput, 0, 150));

        $attempts = $this->userModel->recentFailedAttempts($ip, $identifier, self::LOCK_MINUTES);
        if ($attempts['identifier'] >= self::MAX_ATTEMPTS_ID || $attempts['ip'] >= self::MAX_ATTEMPTS_IP) {
            jsonError('Demasiados intentos fallidos. Espera ' . self::LOCK_MINUTES . ' minutos e intenta de nuevo.', 429);
        }

        $user = filter_var($loginInput, FILTER_VALIDATE_EMAIL)
            ? $this->userModel->findByEmail($loginInput)
            : $this->userModel->findByUsername($loginInput);

        if (!$user || !$this->userModel->verifyPassword($password, $user['password'])) {
            $this->userModel->recordFailedAttempt($ip, $identifier);
            jsonError('Credenciales incorrectas.', 401);
        }

        if ($user['status'] !== 'active') {
            jsonError('La cuenta de usuario se encuentra inactiva o suspendida.', 403);
        }

        $this->userModel->clearAttempts($identifier);
        $this->userModel->rehashIfNeeded((int)$user['id'], $password, $user['password']);

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

        $avatarPath = ImageUploader::fromRequest('avatar', requestData(), 'avatar_base64', 'avatar');
        if (!$avatarPath) {
            jsonError('No se recibió ninguna imagen (JPG, PNG o WEBP, máx. 5MB).', 400);
        }

        $previous = $this->userModel->findById($userId);
        $this->userModel->updateAvatar($userId, $avatarPath);
        ImageUploader::delete($previous['avatar_path'] ?? null);

        jsonSuccess('Foto de perfil actualizada.', [
            'user' => $this->formatUser($this->userModel->findById($userId))
        ]);
    }

    public function logout(): void {
        startSecureSession();
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', [
                'expires'  => time() - 42000,
                'path'     => $p['path'],
                'domain'   => $p['domain'],
                'secure'   => $p['secure'],
                'httponly' => $p['httponly'],
                'samesite' => $p['samesite'] ?? 'Lax',
            ]);
        }
        session_destroy();

        jsonSuccess('Sesión cerrada correctamente.');
    }

    /** Formato estándar del usuario para todas las respuestas */
    public static function formatUser(array $user): array {
        return [
            'id'          => (int)$user['id'],
            'username'    => $user['username'],
            'email'       => $user['email'],
            'tag'         => 'USR-' . $user['id'],
            'avatar_path' => $user['avatar_path'] ?? null,
        ];
    }
}
