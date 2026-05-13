<?php
declare(strict_types=1);

require_once __DIR__ . "/common.php";
require_once __DIR__ . "/auth-internal.php";

function book_presets_user_dir(string $email): string {
    $h = hash("sha256", strtolower(trim($email)));
    return data_path("book-presets/" . $h);
}

function book_presets_list_files(string $dir): array {
    if (!is_dir($dir)) {
        return [];
    }
    $out = [];
    foreach (scandir($dir) ?: [] as $name) {
        if ($name === "." || $name === ".." || !str_ends_with($name, ".json")) {
            continue;
        }
        $full = $dir . DIRECTORY_SEPARATOR . $name;
        if (!is_file($full)) {
            continue;
        }
        $raw = file_get_contents($full);
        if ($raw === false) {
            continue;
        }
        $j = json_decode($raw, true);
        if (!is_array($j)) {
            continue;
        }
        $id = basename($name, ".json");
        $out[] = [
            "id" => $id,
            "name" => (string)($j["name"] ?? $id),
            "updatedAt" => (string)($j["updatedAt"] ?? ""),
            "createdAt" => (string)($j["createdAt"] ?? ""),
        ];
    }
    usort($out, fn ($a, $b) => strcmp((string)$b["updatedAt"], (string)$a["updatedAt"]));
    return $out;
}

if ($_SERVER["REQUEST_METHOD"] === "GET") {
    auth_session_start_safe();
    $email = auth_current_email();
    if ($email === null) {
        json_response(["ok" => false, "error" => "Connexion requise"], 401);
    }
    $dir = book_presets_user_dir($email);
    $id = (string)($_GET["id"] ?? "");
    if ($id !== "") {
        if (preg_match('/[^a-zA-Z0-9_-]/', $id)) {
            json_response(["ok" => false, "error" => "id invalide"], 400);
        }
        $full = $dir . DIRECTORY_SEPARATOR . $id . ".json";
        if (!is_file($full)) {
            json_response(["ok" => false, "error" => "Introuvable"], 404);
        }
        $raw = file_get_contents($full);
        if ($raw === false) {
            json_response(["ok" => false, "error" => "Lecture impossible"], 500);
        }
        $j = json_decode($raw, true);
        json_response(["ok" => true, "item" => is_array($j) ? $j : null]);
    }
    json_response(["ok" => true, "items" => book_presets_list_files($dir)]);
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    json_response(["ok" => false, "error" => "Methode non supportee"], 405);
}

$body = read_json_body();
$action = (string)($body["action"] ?? "");

$email = auth_require_login();
$dir = book_presets_user_dir($email);
if (!is_dir($dir)) {
    mkdir($dir, 0777, true);
}

if ($action === "save") {
    $id = (string)($body["id"] ?? "");
    if ($id === "") {
        $id = "preset_" . bin2hex(random_bytes(6));
    }
    if (preg_match('/[^a-zA-Z0-9_-]/', $id)) {
        json_response(["ok" => false, "error" => "id invalide"], 400);
    }
    $payload = $body["payload"] ?? null;
    if (!is_array($payload)) {
        json_response(["ok" => false, "error" => "payload manquant"], 400);
    }
    $version = (int)($body["version"] ?? 1);
    if ($version !== 1) {
        json_response(["ok" => false, "error" => "version non supportee"], 400);
    }
    $name = (string)($body["name"] ?? "Prereglage");
    $now = gmdate("c");
    $existingPath = $dir . DIRECTORY_SEPARATOR . $id . ".json";
    $createdAt = $now;
    if (is_file($existingPath)) {
        $old = json_decode((string)file_get_contents($existingPath), true);
        if (is_array($old) && isset($old["createdAt"]) && is_string($old["createdAt"])) {
            $createdAt = $old["createdAt"];
        }
    }
    $doc = [
        "version" => 1,
        "name" => $name,
        "createdAt" => $createdAt,
        "updatedAt" => $now,
        "payload" => $payload,
    ];
    $vcp = $body["vaultCompilePaths"] ?? null;
    if (is_array($vcp)) {
        $doc["vaultCompilePaths"] = $vcp;
    }
    $bcm = $body["bookCompileMeta"] ?? null;
    if (is_array($bcm)) {
        $doc["bookCompileMeta"] = $bcm;
    }
    $encoded = json_encode(
        $doc,
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT | JSON_INVALID_UTF8_SUBSTITUTE
    );
    if ($encoded === false || file_put_contents($existingPath, $encoded) === false) {
        json_response(["ok" => false, "error" => "Ecriture impossible"], 500);
    }
    json_response(["ok" => true, "id" => $id, "item" => $doc]);
}

if ($action === "delete") {
    $id = (string)($body["id"] ?? "");
    if ($id === "" || preg_match('/[^a-zA-Z0-9_-]/', $id)) {
        json_response(["ok" => false, "error" => "id invalide"], 400);
    }
    $full = $dir . DIRECTORY_SEPARATOR . $id . ".json";
    if (is_file($full)) {
        unlink($full);
    }
    json_response(["ok" => true]);
}

json_response(["ok" => false, "error" => "action inconnue"], 400);
