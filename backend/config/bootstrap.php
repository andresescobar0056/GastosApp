<?php
/**
 * Arranque común de todos los endpoints de la API.
 *  - Oculta errores al cliente (van al log) y responde JSON genérico ante fallos.
 *  - Cabeceras de seguridad.
 *  - Protección CSRF para peticiones que modifican datos.
 *  - Helpers de entrada y validación.
 */

require_once __DIR__ . '/response.php';
require_once __DIR__ . '/database.php';

ini_set('display_errors', '0');
error_reporting(E_ALL);

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header('Cache-Control: no-store');

set_exception_handler(function (Throwable $e) {
    if ($e instanceof ApiException) {
        jsonError($e->getMessage(), $e->statusCode, $e->data);
    }
    error_log('[API] ' . get_class($e) . ': ' . $e->getMessage() . ' en ' . $e->getFile() . ':' . $e->getLine());
    jsonError('Error interno del servidor.', 500);
});

/**
 * CSRF: toda petición que no sea GET debe
 *  1) traer la cabecera X-Requested-With (un formulario de otro sitio no puede añadirla
 *     sin un preflight CORS, que este servidor no autoriza), y
 *  2) si el navegador envía Origin, que coincida con este mismo host.
 */
function enforceCsrf(): void {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($method === 'GET' || $method === 'HEAD') {
        return;
    }

    if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'XMLHttpRequest') {
        jsonError('Petición rechazada (CSRF).', 403);
    }

    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '') {
        $originHost = parse_url($origin, PHP_URL_HOST);
        $host = preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST'] ?? '');
        if (!$originHost || strcasecmp($originHost, $host) !== 0) {
            jsonError('Origen no permitido.', 403);
        }
    }
}

enforceCsrf();

/** Acciones que modifican datos deben llegar por POST. */
function requirePost(): void {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
        jsonError('Método no permitido.', 405);
    }
}

/** Lee el cuerpo de la petición: multipart/form-data ($_POST) o JSON. */
function requestData(): array {
    if (!empty($_POST)) {
        return $_POST;
    }
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) {
        return [];
    }
    $json = json_decode($raw, true);
    return is_array($json) ? $json : [];
}

/** Valida una fecha estricta en formato YYYY-MM-DD. */
function isValidDate(string $date): bool {
    $d = DateTime::createFromFormat('!Y-m-d', $date);
    return $d !== false && $d->format('Y-m-d') === $date;
}

/** Convierte y valida un monto de dinero (> 0, máx. 2 decimales, dentro de DECIMAL(15,2)). */
function parseAmount(mixed $value, bool $allowZero = false): ?float {
    if (!is_numeric($value)) {
        return null;
    }
    $amount = round((float)$value, 2);
    if ($amount < 0 || (!$allowZero && $amount == 0) || $amount > 9999999999999.99) {
        return null;
    }
    return $amount;
}

/** Recorta un texto a una longitud máxima (multibyte-safe). */
function limitText(?string $text, int $max): string {
    $text = trim((string)$text);
    return mb_substr($text, 0, $max);
}
