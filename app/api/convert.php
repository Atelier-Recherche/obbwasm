<?php
declare(strict_types=1);
require_once __DIR__ . "/common.php";

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    json_response(["ok" => false, "error" => "Methode non supportee"], 405);
}

$body = read_json_body();
$text = (string)($body["text"] ?? "");
$title = (string)($body["title"] ?? "Titre");
$author = (string)($body["author"] ?? "Auteur");
$templatePath = (string)($body["templatePath"] ?? "typeset/typst/layout/Garamond-brsnoba5-layout.typ");

$text = preg_replace('/\s+([;:!?])/u', "\u{00A0}$1", $text ?? "") ?? $text;
$text = preg_replace('/(\d+)\s+(%|kg|g|cm|mm|m|km|€)/u', "$1\u{00A0}$2", $text ?? "") ?? $text;

$typst = "#import \"../shared/layout-base.typ\": apply-layout, default-config\n\n";
$typst .= "#let conf = (..default-config, title: " . json_encode($title) . ", author: " . json_encode($author) . ")\n\n";
$typst .= "#let book-body = [\n";
$typst .= $text . "\n";
$typst .= "]\n\n#apply-layout(conf, book-body)\n";

json_response([
    "ok" => true,
    "templatePath" => $templatePath,
    "typstSource" => $typst,
]);
