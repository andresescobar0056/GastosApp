<?php
/**
 * Controlador de Resumen y Dashboard
 */

require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../models/Transaction.php';
require_once __DIR__ . '/../models/Goal.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../config/response.php';

class DashboardController {
    private User $userModel;
    private Transaction $transactionModel;
    private Goal $goalModel;

    public function __construct() {
        $this->userModel = new User();
        $this->transactionModel = new Transaction();
        $this->goalModel = new Goal();
    }

    public function index(): void {
        $userId = requireAuth();

        $user = $this->userModel->findById($userId);
        $balance = $this->transactionModel->getBalance($userId);
        $totals = $this->transactionModel->getTotals($userId);
        $recents = $this->transactionModel->getRecent($userId, 4);
        $allGoals = $this->goalModel->getByUser($userId);
        $featuredGoal = !empty($allGoals) ? $allGoals[0] : null;

        jsonSuccess('Datos del Dashboard.', [
            'user' => [
                'id'          => (int)$user['id'],
                'username'    => $user['username'],
                'email'       => $user['email'],
                'tag'         => 'USR-' . $user['id'],
                'avatar_path' => $user['avatar_path'] ?? null,
            ],
            'balance'          => $balance,
            'totals'           => $totals,
            'recent_movements' => $recents,
            'featured_goal'    => $featuredGoal
        ]);
    }
}
