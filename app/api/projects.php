<?php
declare(strict_types=1);
require_once __DIR__ . "/common.php";

$store = data_path("projects/projects.json");
$projects = read_json_file($store, []);

if ($_SERVER["REQUEST_METHOD"] === "GET") {
    json_response(["ok" => true, "items" => array_values($projects)]);
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    json_response(["ok" => false, "error" => "Methode non supportee"], 405);
}

$body = read_json_body();
$id = (string)($body["id"] ?? "");

if ($id !== "" && isset($projects[$id])) {
    $projects[$id]["name"] = (string)($body["name"] ?? $projects[$id]["name"]);
    $projects[$id]["templateId"] = (string)($body["templateId"] ?? $projects[$id]["templateId"]);
    $projects[$id]["contentPath"] = (string)($body["contentPath"] ?? $projects[$id]["contentPath"]);
    $projects[$id]["assets"] = is_array($body["assets"] ?? null) ? $body["assets"] : $projects[$id]["assets"];
    $projects[$id]["settings"] = is_array($body["settings"] ?? null) ? $body["settings"] : $projects[$id]["settings"];
    $projects[$id]["updatedAt"] = gmdate("c");
    write_json_file($store, $projects);
    json_response(["ok" => true, "item" => $projects[$id]]);
}

$id = new_id("prj");
$item = [
    "id" => $id,
    "name" => (string)($body["name"] ?? "Nouveau projet"),
    "templateId" => (string)($body["templateId"] ?? ""),
    "contentPath" => (string)($body["contentPath"] ?? ""),
    "assets" => is_array($body["assets"] ?? null) ? $body["assets"] : [],
    "settings" => is_array($body["settings"] ?? null) ? $body["settings"] : [],
    "createdAt" => gmdate("c"),
    "updatedAt" => gmdate("c"),
];

$projects[$id] = $item;
write_json_file($store, $projects);
json_response(["ok" => true, "item" => $item], 201);
