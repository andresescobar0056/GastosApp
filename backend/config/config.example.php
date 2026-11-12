<?php
/**
 * Plantilla de configuración.
 *
 * Copia este archivo como `config.php` (en esta misma carpeta) y rellena los datos.
 * `config.php` está en .gitignore: NUNCA lo subas a un repositorio público.
 *
 * Para XAMPP local los valores por defecto de abajo funcionan tal cual.
 * Para InfinityFree usa los datos de "MySQL Databases" del panel de control
 * (host tipo sqlXXX.infinityfree.com, base tipo if0_XXXXXXX_gastos, etc.).
 */

return [
    'db_host'    => '127.0.0.1',
    'db_name'    => 'control_gastos',
    'db_user'    => 'root',
    'db_pass'    => '',

    // true solo en desarrollo: muestra detalles de errores en el log de PHP
    'debug'      => false,
];
