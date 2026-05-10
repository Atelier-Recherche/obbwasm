<?php
declare(strict_types=1);

require_once __DIR__ . "/common.php";
require_once __DIR__ . "/auth-internal.php";

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    json_response(["ok" => false, "error" => "GET uniquement"], 405);
}

$email = auth_require_login();
$cfg = auth_load_config();
$isAdmin = auth_is_admin_email($email, $cfg);

$templateId = (string)($_GET["templateId"] ?? "");
if ($templateId === "") {
    json_response(["ok" => false, "error" => "templateId manquant"], 400);
}

$store = data_path("templates/templates.json");
$templates = read_json_file($store, []);
if (!isset($templates[$templateId])) {
    json_response(["ok" => false, "error" => "Template introuvable"], 404);
}

$item = $templates[$templateId];
$owner = (string)($item["owner"] ?? "");
$stock = (bool)($item["stock"] ?? false);
$can = $isAdmin || $stock || $owner === $email;
if (!$can) {
    json_response(["ok" => false, "error" => "Acces refuse"], 403);
}

$mainPath = (string)($item["mainTypPath"] ?? "");
if ($mainPath === "") {
    json_response(["ok" => false, "error" => "mainTypPath vide"], 400);
}

function theme_resolve_main_file(string $mainPath): ?string {
    if (str_starts_with($mainPath, "user-templates/")) {
        $dataRoot = realpath(dirname(__DIR__) . DIRECTORY_SEPARATOR . "data");
        if ($dataRoot === false) {
            return null;
        }
        $rel = str_replace(["/", "\\"], DIRECTORY_SEPARATOR, $mainPath);
        $full = realpath($dataRoot . DIRECTORY_SEPARATOR . $rel);
        if ($full !== false && str_starts_with($full, $dataRoot) && is_file($full)) {
            return $full;
        }
        return null;
    }
    $root = project_typeset_root();
    $rootReal = realpath($root);
    if ($rootReal === false) {
        return null;
    }
    $full = realpath($rootReal . DIRECTORY_SEPARATOR . str_replace(["/", "\\"], DIRECTORY_SEPARATOR, $mainPath));
    if ($full !== false && str_starts_with($full, $rootReal) && is_file($full)) {
        return $full;
    }
    return null;
}

$mainFile = theme_resolve_main_file($mainPath);
if ($mainFile === null) {
    json_response(["ok" => false, "error" => "Fichier principal introuvable"], 404);
}

if (!class_exists("ZipArchive")) {
    json_response(["ok" => false, "error" => "Extension Zip PHP requise"], 500);
}

$zip = new ZipArchive();
$tmp = tempnam(sys_get_temp_dir(), "obbtheme");
if ($tmp === false) {
    json_response(["ok" => false, "error" => "Temp indisponible"], 500);
}
@unlink($tmp);
if ($zip->open($tmp, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
    json_response(["ok" => false, "error" => "ZIP impossible"], 500);
}

$manifest = [
    "version" => 1,
    "exportedAt" => gmdate("c"),
    "templateId" => $templateId,
    "name" => $item["name"] ?? "",
    "mainTypPath" => basename($mainPath),
    "variables" => $item["variables"] ?? [],
];
$zip->addFromString("theme.json", json_encode($manifest, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
$zip->addFile($mainFile, basename($mainPath));
$zip->close();

$data = file_get_contents($tmp);
@unlink($tmp);
if ($data === false) {
    json_response(["ok" => false, "error" => "Lecture ZIP impossible"], 500);
}

$safeName = preg_replace("/[^a-zA-Z0-9._-]+/", "_", (string)($item["name"] ?? "theme")) . ".zip";
header("Content-Type: application/zip");
header("Content-Disposition: attachment; filename=\"" . $safeName . "\"");
echo $data;
exit;