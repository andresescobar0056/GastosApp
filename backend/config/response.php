<?php
/**
 * Utilidades para respuestas JSON estandarizadas.
 */

/**
 * Excepción que se lanza para abortar con un error "esperado" (validación, saldo, etc.).
 * Se usa dentro de transacciones para que el rollback ocurra antes de responder.
 */
class ApiException extends Exception {
    public function __construct(string $message, public int $statusCode = 400, public mixed $data = null) {
        parent::__construct($message);
    }
}

function jsonResponse(bool $success, string $message = '', mixed $data = null, int $statusCode = 200): void {
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');

    $response = [
        'success' => $success,
        'message' => $message,
    ];

    if ($data !== null) {
        $response['data'] = $data;
    }

    echo json_encode($response, JSON_UNESCAPED_UNICODE);
    exit;
}

function jsonSuccess(string $message = '', mixed $data = null, int $statusCode = 200): void {
    jsonResponse(true, $message, $data, $statusCode);
}

function jsonError(string $message = 'Error en la solicitud', int $statusCode = 400, mixed $data = null): void {
    jsonResponse(false, $message, $data, $statusCode);
}
