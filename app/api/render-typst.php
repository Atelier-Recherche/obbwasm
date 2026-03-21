<?php
declare(strict_types=1);
require_once __DIR__ . "/common.php";

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    json_response(["ok" => false, "error" => "Methode non supportee"], 405);
}

$body = read_json_body();
$typstSource = (string)($body["typstSource"] ?? "");
if ($typstSource === "") {
    json_response(["ok" => false, "error" => "typstSource manquant"], 400);
}

$tmpDir = data_path("tmp");
if (!is_dir($tmpDir)) {
    mkdir($tmpDir, 0777, true);
}

$jobId = new_id("render");
$inFile = $tmpDir . DIRECTORY_SEPARATOR . $jobId . ".typ";
$outFile = $tmpDir . DIRECTORY_SEPARATOR . $jobId . ".pdf";

if (file_put_contents($inFile, $typstSource) === false) {
    json_response(["ok" => false, "error" => "Impossible d'ecrire le fichier typst temporaire"], 500);
}

$cmd = "typst compile " . escapeshellarg($inFile) . " " . escapeshellarg($outFile) . " 2>&1";
$output = [];
$exit = 0;
exec($cmd, $output, $exit);
$log = implode("\n", $output);

if ($exit !== 0 || !file_exists($outFile)) {
    json_response([
        "ok" => false,
        "error" => "Compilation Typst echouee. Verifier installation Typst CLI sur le serveur PHP.",
        "exitCode" => $exit,
        "log" => $log,
    ], 500);
}

$pdfBin = file_get_contents($outFile);
if ($pdfBin === false) {
    json_response(["ok" => false, "error" => "Impossible de lire le PDF genere"], 500);
}

json_response([
    "ok" => true,
    "jobId" => $jobId,
    "pdfBase64" => base64_encode($pdfBin),
    "log" => $log,
]);
