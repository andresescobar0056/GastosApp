<?php
/**
 * Middleware de Autenticación y Control de Sesión
 */

require_once __DIR__ . '/../config/response.php';

function startSecureSession(): void {
    if (session_status() === PHP_SESSION_NONE) {
        // Opciones de seguridad para cookies de sesión
        $options = [
            'lifetime' => 86400, // 24 horas
            'path' => '/',
            'domain' => '',
            'secure' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on',
            'httponly' => true,
            'samesite' => 'Lax'
        ];
        
        session_set_cookie_params($options);
        session_start();
    }
}

function requireAuth(): int {
    startSecureSession();

    if (!isset($_SESSION['user_id']) || empty($_SESSION['user_id'])) {
        jsonError('No autenticado. Por favor inicia sesión.', 401);
    }

    return (int)$_SESSION['user_id'];
}

function getCurrentUserId(): ?int {
    startSecureSession();
    return isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : null;
}
