<?php
declare(strict_types=1);

require_once __DIR__ . "/common.php";
require_once __DIR__ . "/auth-internal.php";

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    json_response(["ok" => false, "error" => "POST uniquement"], 405);
}

$email = auth_require_login();
$cfg = auth_load_config();
$isAdmin = auth_is_admin_email($email, $cfg);

$body = read_json_body();
$relPath = (string)($body["path"] ?? "");
$source = (string)($body["source"] ?? "");

if ($relPath === "") {
    json_response(["ok" => false, "error" => "path requis"], 400);
}

if (str_contains($relPath, "..") || str_starts_with($relPath, "/")) {
    json_response(["ok" => false, "error" => "path invalide"], 400);
}

if (!str_starts_with($relPath, "user-templates/")) {
    json_response(["ok" => false, "error" => "path doit commencer par user-templates/"], 400);
}

$dataRoot = realpath(dirname(__DIR__) . DIRECTORY_SEPARATOR . "data");
if ($dataRoot === false) {
    json_response(["ok" => false, "error" => "data introuvable"], 500);
}

$rel = str_replace(["/", "\\"], DIRECTORY_SEPARATOR, $relPath);
$full = $dataRoot . DIRECTORY_SEPARATOR . $rel;
$prefix = $dataRoot . DIRECTORY_SEPARATOR . "user-templates";
if (!str_starts_with($full, $prefix)) {
    json_response(["ok" => false, "error" => "Hors user-templates"], 400);
}

if (!preg_match('#^user-templates/([^/]+)/#', str_replace(DIRECTORY_SEPARATOR, "/", $relPath), $m)) {
    json_response(["ok" => false, "error" => "Structure path invalide"], 400);
}

$templateId = $m[1];
$store = data_path("templates/templates.json");
$templates = read_json_file($store, []);
if (!isset($templates[$templateId])) {
    json_response(["ok" => false, "error" => "Template inconnu"], 404);
}

$tOwner = (string)($templates[$templateId]["owner"] ?? "");
if (!$isAdmin && strtolower($tOwner) !== strtolower($email)) {
    json_response(["ok" => false, "error" => "Acces refuse"], 403);
}

$dir = dirname($full);
if (!is_dir($dir)) {
    mkdir($dir, 0777, true);
}

$dirReal = realpath($dir);
if ($dirReal === false || !str_starts_with($dirReal, $prefix)) {
    json_response(["ok" => false, "error" => "Repertoire invalide"], 400);
}

if (file_put_contents($full, $source) === false) {
    json_response(["ok" => false, "error" => "Ecriture impossible"], 500);
}

json_response(["ok" => true, "path" => $relPath]);
