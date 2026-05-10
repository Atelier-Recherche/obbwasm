<?php
declare(strict_types=1);

$cfgPath = __DIR__ . DIRECTORY_SEPARATOR . "auth-config.local.php";
if (!file_exists($cfgPath)) {
    $cfgPath = __DIR__ . DIRECTORY_SEPARATOR . "auth-config.sample.php";
}
$corsCfg = file_exists($cfgPath) ? require $cfgPath : [];
$allowed = is_array($corsCfg) ? ($corsCfg["allowed_origins"] ?? []) : [];
if (!is_array($allowed)) {
    $allowed = [];
}
$origin = (string)($_SERVER["HTTP_ORIGIN"] ?? "");
if ($origin !== "" && in_array($origin, $allowed, true)) {
    header("Access-Control-Allow-Origin: " . $origin);
    header("Access-Control-Allow-Credentials: true");
} else {
    header("Access-Control-Allow-Origin: *");
}
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

function json_response(array $payload, int $status = 200): void {
    http_response_code($status);
    header("Content-Type: application/json; charset=utf-8");
    $json = json_encode(
        $payload,
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT | JSON_INVALID_UTF8_SUBSTITUTE
    );
    if ($json === false) {
        $json = "{\"ok\":false,\"error\":\"Echec encodage JSON\"}";
    }
    echo $json;
    exit;
}

function read_json_body(): array {
    $raw = file_get_contents("php://input");
    if ($raw === false || $raw === "") {
        return [];
    }

    $data = json_decode($raw, true);
    if (!is_array($data)) {
        json_response(["ok" => false, "error" => "Corps JSON invalide"], 400);
    }
    return $data;
}

/**
 * Racine du depot contenant le dossier typeset/ :
 * - en dev : parent de app/ (typeset a cote de app/)
 * - en prod (FTP plat) : meme niveau que api/ et public/ (typeset a cote de api/)
 */
function project_typeset_root(): string {
    $apiDir = __DIR__;
    $parent = dirname($apiDir, 1);
    $grandparent = dirname($apiDir, 2);
    $sep = DIRECTORY_SEPARATOR;
    $t = "typeset";
    if (is_dir($grandparent . $sep . $t)) {
        return $grandparent;
    }
    if (is_dir($parent . $sep . $t)) {
        return $parent;
    }
    return $grandparent;
}

function data_path(string $segment): string {
    return dirname(__DIR__) . DIRECTORY_SEPARATOR . "data" . DIRECTORY_SEPARATOR . $segment;
}

function read_json_file(string $path, array $fallback = []): array {
    if (!file_exists($path)) {
        return $fallback;
    }
    $content = file_get_contents($path);
    if ($content === false || $content === "") {
        return $fallback;
    }
    $parsed = json_decode($content, true);
    return is_array($parsed) ? $parsed : $fallback;
}

function write_json_file(string $path, array $data): void {
    $dir = dirname($path);
    if (!is_dir($dir)) {
        mkdir($dir, 0777, true);
    }
    $encoded = json_encode(
        $data,
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT | JSON_INVALID_UTF8_SUBSTITUTE
    );
    if ($encoded === false || file_put_contents($path, $encoded) === false) {
        json_response(["ok" => false, "error" => "Echec ecriture JSON"], 500);
    }
}

function new_id(string $prefix): string {
    return $prefix . "_" . bin2hex(random_bytes(6));
}
