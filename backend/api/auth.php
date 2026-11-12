<?php
/**
 * API Endpoint: Autenticación
 * Rutas: ?action=login | register | logout | me
 */

require_once __DIR__ . '/../controllers/AuthController.php';

$controller = new AuthController();
$action = $_GET['action'] ?? $_POST['action'] ?? '';

switch ($action) {
    case 'register':
        $controller->register();
        break;

    case 'login':
        $controller->login();
        break;

    case 'logout':
        $controller->logout();
        break;

    case 'me':
        $controller->me();
        break;

    case 'update_avatar':
        $controller->updateAvatar();
        break;

    default:
        jsonError('Acción de autenticación no válida.', 404);
        break;
}
