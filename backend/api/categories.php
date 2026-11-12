<?php
/**
 * API Endpoint: Categorías
 * Rutas: ?action=list
 */

require_once __DIR__ . '/../config/bootstrap.php';
require_once __DIR__ . '/../controllers/CategoryController.php';

$controller = new CategoryController();
$action = $_GET['action'] ?? 'list';

switch ($action) {
    case 'list':
        $controller->list();
        break;

    default:
        jsonError('Acción de categorías no válida.', 404);
}
