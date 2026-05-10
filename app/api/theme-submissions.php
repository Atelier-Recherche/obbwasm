<?php
declare(strict_types=1);

require_once __DIR__ . "/common.php";
require_once __DIR__ . "/auth-internal.php";

$cfg = auth_load_config();
$store = data_path("theme-submissions/submissions.json");
$submissions = read_json_file($store, []);

if ($_SERVER["REQUEST_METHOD"] === "GET") {
    $action = (string)($_GET["action"] ?? "");
    if ($action !== "list") {
        json_response(["ok" => false, "error" => "action=list requis"], 400);
    }
    $email = auth_require_login();
    if (!auth_is_admin_email($email, $cfg)) {
        json_response(["ok" => false, "error" => "Admin uniquement"], 403);
    }
    json_response(["ok" => true, "items" => array_values($submissions)]);
}

if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $ct = (string)($_SERVER["CONTENT_TYPE"] ?? "");
    if (str_starts_with($ct, "multipart/form-data")) {
        $email = auth_require_login();
        $action = (string)($_POST["action"] ?? "submit");
        if ($action !== "submit") {
            json_response(["ok" => false, "error" => "action submit attendue"], 400);
        }
        if (!isset($_FILES["file"]) || !is_uploaded_file($_FILES["file"]["tmp_name"])) {
            json_response(["ok" => false, "error" => "Fichier zip manquant"], 400);
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
        $zip->close();
        if ($themeJson === false) {
            json_response(["ok" => false, "error" => "theme.json requis dans le ZIP"], 400);
        }
        $meta = json_decode($themeJson, true);
        $name = (string)($_POST["name"] ?? (is_array($meta) ? ($meta["name"] ?? "") : ""));
        if ($name === "") {
            json_response(["ok" => false, "error" => "Nom requis"], 400);
        }
        $id = new_id("sub");
        $filesDir = data_path("theme-submissions/files");
        if (!is_dir($filesDir)) {
            mkdir($filesDir, 0777, true);
        }
        $destZip = $filesDir . DIRECTORY_SEPARATOR . $id . ".zip";
        if (!move_uploaded_file($_FILES["file"]["tmp_name"], $destZip)) {
            json_response(["ok" => false, "error" => "Stockage fichier impossible"], 500);
        }
        $submissions[$id] = [
            "id" => $id,
            "submitterEmail" => $email,
            "name" => $name,
            "status" => "pending",
            "createdAt" => gmdate("c"),
            "zipPath" => "theme-submissions/files/" . $id . ".zip",
            "adminNote" => "",
        ];
        write_json_file($store, $submissions);
        json_response(["ok" => true, "item" => $submissions[$id]], 201);
    }

    $body = read_json_body();
    $action = (string)($body["action"] ?? "");
    $email = auth_require_login();
    if (!auth_is_admin_email($email, $cfg)) {
        json_response(["ok" => false, "error" => "Admin uniquement"], 403);
    }
    if ($action === "reject") {
        $id = (string)($body["id"] ?? "");
        if ($id === "" || !isset($submissions[$id])) {
            json_response(["ok" => false, "error" => "Soumission introuvable"], 404);
        }
        $submissions[$id]["status"] = "rejected";
        $submissions[$id]["adminNote"] = (string)($body["note"] ?? "");
        $submissions[$id]["reviewedAt"] = gmdate("c");
        $zp = data_path($submissions[$id]["zipPath"]);
        if (is_file($zp)) {
            @unlink($zp);
        }
        write_json_file($store, $submissions);
        json_response(["ok" => true, "item" => $submissions[$id]]);
    }
    if ($action === "approve") {
        $id = (string)($body["id"] ?? "");
        if ($id === "" || !isset($submissions[$id])) {
            json_response(["ok" => false, "error" => "Soumission introuvable"], 404);
        }
        $row = $submissions[$id];
        if (($row["status"] ?? "") !== "pending") {
            json_response(["ok" => false, "error" => "Deja traite"], 400);
        }
        $zp = data_path($row["zipPath"]);
        if (!is_file($zp)) {
            json_response(["ok" => false, "error" => "Fichier ZIP manquant"], 400);
        }
        $zip = new ZipArchive();
        if ($zip->open($zp) !== true) {
            json_response(["ok" => false, "error" => "ZIP illisible"], 500);
        }
        $themeJson = $zip->getFromName("theme.json");
        if ($themeJson === false) {
            $zip->close();
            json_response(["ok" => false, "error" => "theme.json manquant"], 400);
        }
        $meta = json_decode($themeJson, true);
        $mainName = is_array($meta) ? (string)($meta["mainTypPath"] ?? "") : "";
        if ($mainName === "") {
            $zip->close();
            json_response(["ok" => false, "error" => "mainTypPath manquant"], 400);
        }
        $mainContent = $zip->getFromName($mainName);
        $zip->close();
        if ($mainContent === false) {
            json_response(["ok" => false, "error" => "Fichier principal absent"], 400);
        }
        $typesetRoot = project_typeset_root();
        $slug = preg_replace("/[^a-zA-Z0-9_-]+/", "_", $id);
        $relDir = "typeset/typst/layout/submitted/" . $slug;
        $absDir = $typesetRoot . DIRECTORY_SEPARATOR . str_replace("/", DIRECTORY_SEPARATOR, $relDir);
        if (!is_dir($absDir)) {
            mkdir($absDir, 0777, true);
        }
        $baseFile = basename($mainName);
        $destFile = $absDir . DIRECTORY_SEPARATOR . $baseFile;
        if (file_put_contents($destFile, $mainContent) === false) {
            json_response(["ok" => false, "error" => "Ecriture typeset impossible"], 500);
        }
        $tplStore = data_path("templates/templates.json");
        $templates = read_json_file($tplStore, []);
        $tid = new_id("tpl");
        $templates[$tid] = [
            "id" => $tid,
            "name" => (string)($row["name"] ?? "Theme soumis"),
            "owner" => (string)($row["submitterEmail"] ?? "stock"),
            "stock" => true,
            "mainTypPath" => $relDir . "/" . $baseFile,
            "variables" => is_array($meta["variables"] ?? null) ? $meta["variables"] : [],
            "layoutUi" => [],
            "createdAt" => gmdate("c"),
            "fromSubmission" => $id,
        ];
        write_json_file($tplStore, $templates);
        $submissions[$id]["status"] = "approved";
        $submissions[$id]["approvedTemplateId"] = $tid;
        $submissions[$id]["reviewedAt"] = gmdate("c");
        @unlink($zp);
        write_json_file($store, $submissions);
        json_response(["ok" => true, "template" => $templates[$tid]]);
    }
}

json_response(["ok" => false, "error" => "Methode non supportee"], 405);
