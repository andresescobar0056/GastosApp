<?php
/**
 * API Endpoint: Movimientos / Transacciones
 * Rutas: ?action=list | detail | create | update | delete
 */

require_once __DIR__ . '/../config/bootstrap.php';
require_once __DIR__ . '/../controllers/TransactionController.php';

$controller = new TransactionController();
$action = $_GET['action'] ?? 'list';

switch ($action) {
    case 'list':
        $controller->list();
        break;

    case 'detail':
        $controller->detail();
        break;

    case 'create':
        requirePost();
        $controller->create();
        break;

    case 'update':
        requirePost();
        $controller->update();
        break;

    case 'delete':
        requirePost();
        $controller->delete();
        break;

    default:
        jsonError('Acción de movimientos no válida.', 404);
}
