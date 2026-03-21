<?php
declare(strict_types=1);
require_once __DIR__ . "/common.php";

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    json_response(["ok" => false, "error" => "Methode non supportee"], 405);
}

$body = read_json_body();
$innerPages = (int)($body["innerPages"] ?? 0);
$signatureSize = max(1, (int)($body["signatureSize"] ?? 16));
$mode = (string)($body["mode"] ?? "saddle-stitch");
$needsMultiple = $mode === "section-sewing" ? $signatureSize : 4;
$missingPages = $innerPages > 0 ? ($needsMultiple - ($innerPages % $needsMultiple)) % $needsMultiple : 0;
$creepPerLeaf = (float)($body["creepPerLeafMm"] ?? 0.08);
$creepTotal = (($innerPages / 2) - 1) * $creepPerLeaf;

json_response([
    "ok" => true,
    "needsMultiple" => $needsMultiple,
    "missingPages" => $missingPages,
    "creepTotalMm" => round($creepTotal, 2),
]);
