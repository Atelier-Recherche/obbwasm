<?php
declare(strict_types=1);

require_once __DIR__ . "/common.php";
require_once __DIR__ . "/auth-internal.php";

$packagesRoot = data_path("typst-packages");
if (!is_dir($packagesRoot)) {
    mkdir($packagesRoot, 0777, true);
}

$rootReal = realpath($packagesRoot);
if ($rootReal === false) {
    json_response(["ok" => false, "error" => "Paquets introuvables"], 500);
}

function typst_packages_list(string $rootReal): array {
    $items = [];
    $dh = opendir($rootReal);
    if ($dh === false) {
        return [];
    }
    while (($name = readdir($dh)) !== false) {
        if ($name === "." || $name === "..") {
            continue;
        }
        $full = $rootReal . DIRECTORY_SEPARATOR . $name;
        if (!is_dir($full)) {
            continue;
        }
        $metaPath = $full . DIRECTORY_SEPARATOR . "package.json";
        $label = $name;
        if (is_file($metaPath)) {
            $mj = json_decode((string)file_get_contents($metaPath), true);
            if (is_array($mj) && isset($mj["name"]) && is_string($mj["name"])) {
                $label = $mj["name"];
            }
        }
        $items[] = ["id" => $name, "name" => $label];
    }
    closedir($dh);
    usort($items, fn ($a, $b) => strcmp($a["id"], $b["id"]));
    return $items;
}

if ($_SERVER["REQUEST_METHOD"] === "GET") {
    $action = (string)($_GET["action"] ?? "list");
    if ($action === "list") {
        json_response(["ok" => true, "items" => typst_packages_list($rootReal)]);
    }
    if ($action === "archive") {
        $id = (string)($_GET["id"] ?? "");
        if ($id === "" || str_contains($id, "..") || str_contains($id, "/") || str_contains($id, "\\")) {
            json_response(["ok" => false, "error" => "id invalide"], 400);
        }
        $full = realpath($rootReal . DIRECTORY_SEPARATOR . $id);
        if ($full === false || !str_starts_with($full, $rootReal) || !is_dir($full)) {
            json_response(["ok" => false, "error" => "Paquet introuvable"], 404);
        }
        if (!class_exists("ZipArchive")) {
            json_response(["ok" => false, "error" => "ZipArchive requis"], 500);
        }
        $tmp = tempnam(sys_get_temp_dir(), "obb_pkg_");
        if ($tmp === false) {
            json_response(["ok" => false, "error" => "Temp indisponible"], 500);
        }
        $zip = new ZipArchive();
        if ($zip->open($tmp, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            @unlink($tmp);
            json_response(["ok" => false, "error" => "ZIP impossible"], 500);
        }
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($full, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::SELF_FIRST
        );
        foreach ($iterator as $info) {
            /** @var SplFileInfo $info */
            $path = $info->getPathname();
            $rel = substr($path, strlen($full) + 1);
            $rel = str_replace("\\", "/", $rel);
            if ($info->isDir()) {
                continue;
            }
            $zip->addFile($path, $rel);
        }
        $zip->close();
        header("Content-Type: application/zip");
        header("Content-Disposition: attachment; filename=\"" . rawurlencode($id) . ".zip\"");
        readfile($tmp);
        @unlink($tmp);
        exit;
    }
    json_response(["ok" => false, "error" => "Action inconnue"], 400);
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    json_response(["ok" => false, "error" => "Methode non supportee"], 405);
}

$email = auth_require_login();
$cfg = auth_load_config();
if (!auth_is_admin_email($email, $cfg)) {
    json_response(["ok" => false, "error" => "Admin uniquement"], 403);
}

if (!isset($_FILES["file"]) || !is_uploaded_file($_FILES["file"]["tmp_name"])) {
    json_response(["ok" => false, "error" => "Fichier zip manquant"], 400);
}

if (!class_exists("ZipArchive")) {
    json_response(["ok" => false, "error" => "Extension Zip PHP requise"], 500);
}

$id = new_id("pkg");
$destDir = $packagesRoot . DIRECTORY_SEPARATOR . $id;
if (!mkdir($destDir, 0777, true) && !is_dir($destDir)) {
    json_response(["ok" => false, "error" => "Creation repertoire impossible"], 500);
}

$zip = new ZipArchive();
if ($zip->open($_FILES["file"]["tmp_name"]) !== true) {
    json_response(["ok" => false, "error" => "ZIP invalide"], 400);
}

for ($i = 0; $i < $zip->numFiles; $i++) {
    $name = $zip->getNameIndex($i);
    if ($name === false || str_ends_with($name, "/")) {
        continue;
    }
    if (str_contains($name, "..")) {
        continue;
    }
    $content = $zip->getFromIndex($i);
    if ($content === false) {
        continue;
    }
    $target = $destDir . DIRECTORY_SEPARATOR . str_replace(["/", "\\"], DIRECTORY_SEPARATOR, $name);
    $sub = dirname($target);
    if (!is_dir($sub)) {
        mkdir($sub, 0777, true);
    }
    $dr = realpath($destDir);
    $sr = realpath($sub);
    if ($dr !== false && $sr !== false && str_starts_with($sr, $dr)) {
        file_put_contents($target, $content);
    }
}
$zip->close();

$nameLabel = (string)($_POST["name"] ?? $id);
$pkgMeta = ["name" => $nameLabel, "id" => $id, "uploadedAt" => gmdate("c"), "uploadedBy" => $email];
file_put_contents($destDir . "/package.json", json_encode($pkgMeta, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

json_response(["ok" => true, "item" => $pkgMeta], 201);
