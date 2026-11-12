<?php
/**
 * Utilidades para Respuestas JSON Estandarizadas
 */

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
