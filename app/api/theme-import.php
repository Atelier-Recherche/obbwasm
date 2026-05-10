<?php
declare(strict_types=1);

require_once __DIR__ . "/common.php";
require_once __DIR__ . "/auth-internal.php";

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    json_response(["ok" => false, "error" => "POST uniquement"], 405);
}

$email = auth_require_login();

if (!isset($_FILES["file"]) || !is_uploaded_file($_FILES["file"]["tmp_name"])) {
    json_response(["ok" => false, "error" => "Fichier zip manquant (champ file)"], 400);
}

if (!class_exists("ZipArchive")) {
    json_response(["ok" => false, "error" => "Extension Zip PHP requise"], 500);
}

$tmpZip = $_FILES["file"]["tmp_name"];
$zip = new ZipArchive();
if ($zip->open($tmpZip) !== true) {
    json_response(["ok" => false, "error" => "ZIP invalide"], 400);
}

$themeJson = $zip->getFromName("theme.json");
if ($themeJson === false) {
    $zip->close();
    json_response(["ok" => false, "error" => "theme.json manquant dans le ZIP"], 400);
}

$meta = json_decode($themeJson, true);
if (!is_array($meta)) {
    $zip->close();
    json_response(["ok" => false, "error" => "theme.json invalide"], 400);
}

$mainName = (string)($meta["mainTypPath"] ?? "");
if ($mainName === "") {
    $zip->close();
    json_response(["ok" => false, "error" => "mainTypPath dans theme.json requis"], 400);
}

$mainContent = $zip->getFromName($mainName);
if ($mainContent === false) {
    $zip->close();
    json_response(["ok" => false, "error" => "Fichier Typst principal absent du ZIP"], 400);
}

$id = new_id("tpl");
$dir = data_path("user-templates/" . $id);
if (!is_dir($dir)) {
    mkdir($dir, 0777, true);
}
$destMain = $dir . DIRECTORY_SEPARATOR . basename($mainName);
if (file_put_contents($destMain, $mainContent) === false) {
    $zip->close();
    json_response(["ok" => false, "error" => "Ecriture impossible"], 500);
}

$dirReal = realpath($dir);
for ($i = 0; $i < $zip->numFiles; $i++) {
    $name = $zip->getNameIndex($i);
    if ($name === false || $name === "theme.json" || $name === $mainName) {
        continue;
    }
    if (str_ends_with($name, "/")) {
        continue;
    }
    $content = $zip->getFromIndex($i);
    if ($content === false) {
        continue;
    }
    $base = basename($name);
    if ($base === ".." || str_contains($name, "..")) {
        continue;
    }
    $target = $dir . DIRECTORY_SEPARATOR . str_replace(["/", "\\"], DIRECTORY_SEPARATOR, $name);
    $sub = dirname($target);
    if (!is_dir($sub)) {
        mkdir($sub, 0777, true);
    }
    $tReal = realpath($sub);
    if ($dirReal !== false && $tReal !== false && !str_starts_with($tReal, $dirReal)) {
        continue;
    }
    @file_put_contents($target, $content);
}
$zip->close();

$store = data_path("templates/templates.json");
$templates = read_json_file($store, []);
$name = (string)($_POST["name"] ?? $meta["name"] ?? "Theme importe");
$item = [
    "id" => $id,
    "name" => $name,
    "owner" => $email,
    "stock" => false,
    "mainTypPath" => "user-templates/" . $id . "/" . basename($mainName),
    "variables" => is_array($meta["variables"] ?? null) ? $meta["variables"] : [],
    "layoutUi" => [],
    "createdAt" => gmdate("c"),
];
$templates[$id] = $item;
write_json_file($store, $templates);
json_response(["ok" => true, "item" => $item], 201);
