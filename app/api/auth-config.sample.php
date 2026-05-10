<?php
/**
 * Copier ce fichier vers auth-config.local.php (non versionne) et ajuster.
 * En absence de auth-config.local.php, des valeurs de developpement sont appliquees.
 */
declare(strict_types=1);

return [
    "admin_email" => "admin@example.com",
    /** URL de l'app front pour le lien magique (sans slash final) */
    "app_public_url" => "http://localhost:5173",
    "session_cookie_secure" => false,
    "session_cookie_samesite" => "Lax",
    /** Origines autorisees pour CORS avec credentials */
    "allowed_origins" => [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    /** Journal diagnostic envoi mail (vide = app/data/logs/obbwasm-mail.log). Pas accessible par URL si data/ est hors webroot. */
    "mail_debug_log_file" => "",
    "mail_debug_log_enabled" => true,
    /**
     * SMTP pour les magic links en production (recommande).
     * Laisser host vide pour utiliser mail() PHP (souvent limite en hebergement mutualise).
     *
     * - user : si vide mais password rempli, l'identifiant utilise par defaut est from_email
     *   (beaucoup d'hebergeurs exigent le compte complet, ex. obsidian@domaine.tld).
     * - password : si le mot de passe contient $ ou \, utiliser des guillemets simples PHP
     *   ex. 'secret$$mot' et non "secret$$mot" (sinon $$ est interprete).
     * - ssl_verify_peer : a false seulement si la connexion SSL au serveur SMTP echoue (certificat).
     */
    "smtp" => [
        "host" => "",
        "port" => 587,
        "user" => "",
        "password" => "",
        /** login (defaut) | plain | plain_user — plain essaie RFC puis variante user+user si 535. */
        "auth" => "login",
        "from_email" => "noreply@example.com",
        "from_name" => "OBBWASM",
        /** Optionnel : 2e destinataire (RCPT) pour verifier la delivrance (ex. Gmail), puis retirer. */
        "diagnostic_rcpt" => "",
        "encryption" => "tls",
        "ssl_verify_peer" => true,
    ],
];
