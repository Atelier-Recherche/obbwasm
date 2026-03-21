<?php
declare(strict_types=1);
require_once __DIR__ . "/common.php";

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    json_response(["ok" => false, "error" => "Methode non supportee"], 405);
}

$path = (string)($_GET["path"] ?? "");
if ($path === "") {
    json_response(["ok" => false, "error" => "Parametre path manquant"], 400);
}

$root = dirname(__DIR__, 2);
$full = realpath($root . DIRECTORY_SEPARATOR . str_replace(["/", "\\"], DIRECTORY_SEPARATOR, $path));
if ($full === false || !str_starts_with($full, $root)) {
    json_response(["ok" => false, "error" => "Chemin template invalide"], 400);
}
if (!is_file($full)) {
    json_response(["ok" => false, "error" => "Template introuvable"], 404);
}

$content = file_get_contents($full);
if ($content === false) {
    json_response(["ok" => false, "error" => "Lecture template impossible"], 500);
}

json_response([
    "ok" => true,
    "path" => $path,
    "source" => $content,
]);
