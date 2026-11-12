<?php
/**
 * API Endpoint: Autenticación
 * Rutas: ?action=login | register | logout | me | update_avatar
 */

require_once __DIR__ . '/../config/bootstrap.php';
require_once __DIR__ . '/../controllers/AuthController.php';

$controller = new AuthController();
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'register':
        requirePost();
        $controller->register();
        break;

    case 'login':
        requirePost();
        $controller->login();
        break;

    case 'logout':
        requirePost();
        $controller->logout();
        break;

    case 'me':
        $controller->me();
        break;

    case 'update_avatar':
        requirePost();
        $controller->updateAvatar();
        break;

    default:
        jsonError('Acción de autenticación no válida.', 404);
}
