<?php
/**
 * API Endpoint: Resumen del Dashboard
 * Retorna saldo consolidado de servidor, totales, movimientos recientes y meta destacada
 */

require_once __DIR__ . '/../controllers/DashboardController.php';

$controller = new DashboardController();
$controller->index();
