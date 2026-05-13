<?php
declare(strict_types=1);
require_once __DIR__ . "/common.php";

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    json_response(["ok" => false, "error" => "Methode non supportee"], 405);
}

$root = project_typeset_root();
$fontsFlat = $root . DIRECTORY_SEPARATOR . "typeset" . DIRECTORY_SEPARATOR . "fonts";
$fontsLegacy = $root . DIRECTORY_SEPARATOR . "typeset" . DIRECTORY_SEPARATOR . "typst" . DIRECTORY_SEPARATOR . "fonts";
$fontsRoot = is_dir($fontsFlat) ? $fontsFlat : $fontsLegacy;
$action = (string)($_GET["action"] ?? "list");

if ($action === "list") {
    if (!is_dir($fontsRoot)) {
        json_response(["ok" => true, "items" => []]);
    }
    $items = [];
    $it = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($fontsRoot, FilesystemIterator::SKIP_DOTS)
    );
    foreach ($it as $file) {
        if (!$file->isFile()) continue;
        $ext = strtolower(pathinfo($file->getFilename(), PATHINFO_EXTENSION));
        if (!in_array($ext, ["ttf", "otf"], true)) continue;
        $full = $file->getPathname();
        $rel = str_replace($root . DIRECTORY_SEPARATOR, "", $full);
        $rel = str_replace(DIRECTORY_SEPARATOR, "/", $rel);
        $items[] = [
            "path" => $rel,
            "name" => $file->getFilename(),
            "size" => $file->getSize(),
        ];
    }
    json_response(["ok" => true, "items" => $items]);
}

if ($action === "file") {
    $path = (string)($_GET["path"] ?? "");
    if ($path === "") {
        json_response(["ok" => false, "error" => "Parametre path manquant"], 400);
    }

    $full = realpath($root . DIRECTORY_SEPARATOR . str_replace(["/", "\\"], DIRECTORY_SEPARATOR, $path));
    $flatReal = is_dir($fontsFlat) ? realpath($fontsFlat) : false;
    $legacyReal = is_dir($fontsLegacy) ? realpath($fontsLegacy) : false;
    $ok = false;
    if ($full !== false) {
        if ($flatReal !== false && str_starts_with($full, $flatReal)) {
            $ok = true;
        }
        if ($legacyReal !== false && str_starts_with($full, $legacyReal)) {
            $ok = true;
        }
    }
    if ($full === false || !$ok) {
        json_response(["ok" => false, "error" => "Chemin police invalide"], 400);
    }
    if (!is_file($full)) {
        json_response(["ok" => false, "error" => "Police introuvable"], 404);
    }

    $bin = file_get_contents($full);
    if ($bin === false) {
        json_response(["ok" => false, "error" => "Lecture police impossible"], 500);
    }

    header("Content-Type: application/octet-stream");
    header("Content-Length: " . strlen($bin));
    echo $bin;
    exit;
}

json_response(["ok" => false, "error" => "Action inconnue"], 400);
