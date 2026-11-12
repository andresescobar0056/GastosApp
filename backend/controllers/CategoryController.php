<?php
/**
 * Controlador de Categorías
 */

require_once __DIR__ . '/../models/Category.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../config/response.php';

class CategoryController {
    private Category $categoryModel;

    public function __construct() {
        $this->categoryModel = new Category();
    }

    public function list(): void {
        $userId = getCurrentUserId();
        $categories = $this->categoryModel->getForUser($userId);

        jsonSuccess('Categorías obtenidas.', ['categories' => $categories]);
    }
}
