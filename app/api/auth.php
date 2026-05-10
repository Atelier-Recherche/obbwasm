<?php
declare(strict_types=1);

require_once __DIR__ . "/common.php";
require_once __DIR__ . "/auth-internal.php";

$cfg = auth_load_config();
$postJson = null;
if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $raw = file_get_contents("php://input");
    if ($raw !== false && $raw !== "") {
        $decoded = json_decode($raw, true);
        $postJson = is_array($decoded) ? $decoded : [];
    } else {
        $postJson = [];
    }
}
$pj = is_array($postJson) ? $postJson : [];
$action = (string)($_GET["action"] ?? $_POST["action"] ?? ($pj["action"] ?? ""));

if ($_SERVER["REQUEST_METHOD"] === "GET" && $action === "verify") {
    $token = (string)($_GET["token"] ?? "");
    if ($token === "") {
        header("Location: " . ((string)($cfg["app_public_url"] ?? "/")) . "?auth=error");
        exit;
    }
    $email = auth_consume_magic_token($token);
    if ($email === null) {
        header("Location: " . ((string)($cfg["app_public_url"] ?? "/")) . "?auth=invalid");
        exit;
    }
    auth_login_email($email);
    $redir = (string)($_GET["redirect"] ?? "");
    $base = rtrim((string)($cfg["app_public_url"] ?? "/"), "/");
    if ($redir !== "" && str_starts_with($redir, $base)) {
        header("Location: " . $redir . "?auth=ok");
    } else {
        header("Location: " . $base . "/?auth=ok");
    }
    exit;
}

if ($_SERVER["REQUEST_METHOD"] === "GET" && $action === "me") {
    auth_session_start_safe();
    $email = auth_current_email();
    if ($email === null) {
        json_response(["ok" => true, "authenticated" => false, "user" => null]);
    }
    json_response([
        "ok" => true,
        "authenticated" => true,
        "user" => [
            "email" => $email,
            "isAdmin" => auth_is_admin_email($email, $cfg),
        ],
    ]);
}

if ($_SERVER["REQUEST_METHOD"] === "POST" && $action === "logout") {
    auth_logout();
    json_response(["ok" => true]);
}

if ($_SERVER["REQUEST_METHOD"] === "POST" && $action === "request-link") {
    $body = is_array($postJson) ? $postJson : [];
    $email = strtolower(trim((string)($body["email"] ?? "")));
    if ($email === "" || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_response(["ok" => false, "error" => "Email invalide"], 400);
    }
    if (!auth_rate_limit_ok(auth_rate_limit_key($email))) {
        json_response(["ok" => true, "message" => "Si cet email est connu, un lien a ete envoye."]);
    }
    $token = bin2hex(random_bytes(32));
    auth_store_magic_token($token, $email);
    $base = rtrim((string)($cfg["app_public_url"] ?? ""), "/");
    $apiBase = (isset($_SERVER["HTTPS"]) && $_SERVER["HTTPS"] !== "off" ? "https" : "http")
        . "://" . ($_SERVER["HTTP_HOST"] ?? "localhost")
        . dirname($_SERVER["SCRIPT_NAME"] ?? "/api/auth.php");
    $apiBase = str_replace("\\", "/", $apiBase);
    $link = $apiBase . "/auth.php?action=verify&token=" . urlencode($token);
    $subject = "Connexion OBBWASM";
    $bodyText = "Bonjour,\n\nCliquez pour vous connecter (valide 15 min) :\n" . $link . "\n\nSi vous n'avez pas demande ce lien, ignorez ce message.\n";
    $mailOk = auth_send_mail_smtp_or_mail($email, $subject, $bodyText, $cfg);
    $logPath = auth_mail_log_file($cfg);
    $payload = [
        "ok" => true,
        "message" => "Si cet email est valide, un lien vous a ete envoye.",
        "mailDelivered" => $mailOk,
    ];
    if (!$mailOk) {
        $payload["debugLogPath"] = $logPath;
    }
    json_response($payload);
}

json_response(["ok" => false, "error" => "Action inconnue"], 400);
