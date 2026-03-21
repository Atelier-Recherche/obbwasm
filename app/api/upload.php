<?php
declare(strict_types=1);
require_once __DIR__ . "/common.php";

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    json_response(["ok" => false, "error" => "Methode non supportee"], 405);
}

if (!isset($_FILES["file"])) {
    json_response(["ok" => false, "error" => "Aucun fichier transmis"], 400);
}

$f = $_FILES["file"];
if (!is_array($f) || ($f["error"] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    json_response(["ok" => false, "error" => "Upload invalide"], 400);
}

$original = (string)$f["name"];
$ext = strtolower(pathinfo($original, PATHINFO_EXTENSION));
$safeName = preg_replace("/[^a-zA-Z0-9._-]/", "_", $original);
$id = new_id("asset");
$filename = $id . "_" . $safeName;
$targetDir = data_path("assets/files");
$targetPath = $targetDir . DIRECTORY_SEPARATOR . $filename;

if (!is_dir($targetDir)) {
    mkdir($targetDir, 0777, true);
}
if (!move_uploaded_file((string)$f["tmp_name"], $targetPath)) {
    json_response(["ok" => false, "error" => "Echec stockage fichier"], 500);
}

$metaStore = data_path("assets/assets.json");
$assets = read_json_file($metaStore, []);
$item = [
    "id" => $id,
    "name" => $original,
    "ext" => $ext,
    "size" => (int)$f["size"],
    "storedAs" => "data/assets/files/" . $filename,
    "createdAt" => gmdate("c"),
];
$assets[$id] = $item;
write_json_file($metaStore, $assets);

json_response(["ok" => true, "item" => $item], 201);
