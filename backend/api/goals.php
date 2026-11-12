<?php
/**
 * API Endpoint: Metas de Ahorro
 * Rutas: ?action=list | detail | create | update | deposit | delete
 */

require_once __DIR__ . '/../controllers/GoalController.php';

$controller = new GoalController();
$action = $_GET['action'] ?? $_POST['action'] ?? 'list';

switch ($action) {
    case 'list':
        $controller->list();
        break;

    case 'detail':
        $controller->detail();
        break;

    case 'create':
        $controller->create();
        break;

    case 'update':
        $controller->update();
        break;

    case 'deposit':
        $controller->deposit();
        break;

    case 'delete':
        $controller->delete();
        break;

    case 'update_image':
        $controller->updateImage();
        break;

    default:
        jsonError('Acción de metas no válida.', 404);
        break;
}
