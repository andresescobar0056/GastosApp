<?php
/**
 * Middleware de autenticación y control de sesión.
 */

require_once __DIR__ . '/../config/response.php';

function isHttps(): bool {
    if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
        return true;
    }
    // Hostings detrás de proxy (InfinityFree, Cloudflare...) indican HTTPS por cabecera
    return strtolower($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
}

function startSecureSession(): void {
    if (session_status() === PHP_SESSION_NONE) {
        ini_set('session.use_strict_mode', '1');
        session_set_cookie_params([
            'lifetime' => 86400, // 24 horas
            'path'     => '/',
            'domain'   => '',
            'secure'   => isHttps(),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_name('gastos_sid');
        session_start();
    }
}

function requireAuth(): int {
    startSecureSession();

    if (empty($_SESSION['user_id'])) {
        jsonError('No autenticado. Por favor inicia sesión.', 401);
    }

    return (int)$_SESSION['user_id'];
}

function getCurrentUserId(): ?int {
    startSecureSession();
    return isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : null;
}
