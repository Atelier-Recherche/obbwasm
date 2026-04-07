<?php
declare(strict_types=1);
require_once __DIR__ . "/common.php";

$store = data_path("templates/templates.json");
$templates = read_json_file($store, []);

if ($_SERVER["REQUEST_METHOD"] === "GET") {
    json_response(["ok" => true, "items" => array_values($templates)]);
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    json_response(["ok" => false, "error" => "Methode non supportee"], 405);
}

$body = read_json_body();
$action = (string)($body["action"] ?? "create");

if ($action === "fork") {
    $sourceId = (string)($body["sourceId"] ?? "");
    $owner = (string)($body["owner"] ?? "user");
    if ($sourceId === "" || !isset($templates[$sourceId])) {
        json_response(["ok" => false, "error" => "Template source introuvable"], 404);
    }
    $base = $templates[$sourceId];
    $id = new_id("tpl");
    $base["id"] = $id;
    $base["owner"] = $owner;
    $base["name"] = (string)($body["name"] ?? ($base["name"] . " (fork)"));
    $base["stock"] = false;
    $base["createdAt"] = gmdate("c");
    $templates[$id] = $base;
    write_json_file($store, $templates);
    json_response(["ok" => true, "item" => $base], 201);
}

$id = new_id("tpl");
$item = [
    "id" => $id,
    "name" => (string)($body["name"] ?? "Nouveau template"),
    "owner" => (string)($body["owner"] ?? "user"),
    "stock" => (bool)($body["stock"] ?? false),
    "mainTypPath" => (string)($body["mainTypPath"] ?? "typeset/typst/layout/Garamond-brsnoba5-layout.typ"),
    "variables" => is_array($body["variables"] ?? null) ? $body["variables"] : [],
    "layoutUi" => is_array($body["layoutUi"] ?? null) ? $body["layoutUi"] : [],
    "createdAt" => gmdate("c"),
];

$templates[$id] = $item;
write_json_file($store, $templates);
json_response(["ok" => true, "item" => $item], 201);
