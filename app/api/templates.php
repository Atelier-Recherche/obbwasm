<?php
declare(strict_types=1);

require_once __DIR__ . "/common.php";
require_once __DIR__ . "/auth-internal.php";

$store = data_path("templates/templates.json");
$templates = read_json_file($store, []);

if ($_SERVER["REQUEST_METHOD"] === "GET") {
    json_response(["ok" => true, "items" => array_values($templates)]);
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    json_response(["ok" => false, "error" => "Methode non supportee"], 405);
}

$email = auth_require_login();
$cfg = auth_load_config();
$isAdmin = auth_is_admin_email($email, $cfg);

$body = read_json_body();
$action = (string)($body["action"] ?? "create");

if ($action === "fork") {
    $sourceId = (string)($body["sourceId"] ?? "");
    if ($sourceId === "" || !isset($templates[$sourceId])) {
        json_response(["ok" => false, "error" => "Template source introuvable"], 404);
    }
    $base = $templates[$sourceId];
    $id = new_id("tpl");
    $base["id"] = $id;
    $base["owner"] = $email;
    $base["name"] = (string)($body["name"] ?? ($base["name"] . " (fork)"));
    $base["stock"] = false;
    $base["createdAt"] = gmdate("c");
    $templates[$id] = $base;
    write_json_file($store, $templates);
    json_response(["ok" => true, "item" => $base], 201);
}

$id = new_id("tpl");
$stock = false;
if ($isAdmin && array_key_exists("stock", $body)) {
    $stock = (bool)$body["stock"];
}
$item = [
    "id" => $id,
    "name" => (string)($body["name"] ?? "Nouveau template"),
    "owner" => $email,
    "stock" => $stock,
    "mainTypPath" => (string)($body["mainTypPath"] ?? "typeset/typst/layout/Garamond-brsnoba5-layout.typ"),
    "variables" => is_array($body["variables"] ?? null) ? $body["variables"] : [],
    "layoutUi" => is_array($body["layoutUi"] ?? null) ? $body["layoutUi"] : [],
    "createdAt" => gmdate("c"),
];

$templates[$id] = $item;
write_json_file($store, $templates);
json_response(["ok" => true, "item" => $item], 201);
