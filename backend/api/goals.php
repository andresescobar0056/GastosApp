<?php
/**
 * API Endpoint: Metas de Ahorro
 * Rutas: ?action=list | detail | create | update | update_image | deposit | delete
 */

require_once __DIR__ . '/../config/bootstrap.php';
require_once __DIR__ . '/../controllers/GoalController.php';

$controller = new GoalController();
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

    case 'update_image':
        requirePost();
        $controller->updateImage();
        break;

    case 'deposit':
        requirePost();
        $controller->deposit();
        break;

    case 'delete':
        requirePost();
        $controller->delete();
        break;

    default:
        jsonError('Acción de metas no válida.', 404);
}
