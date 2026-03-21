<?php
declare(strict_types=1);

header("Access-Control-Allow-Origin: *");
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
