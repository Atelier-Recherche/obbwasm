<?php
declare(strict_types=1);
require_once __DIR__ . "/common.php";

json_response([
    "ok" => true,
    "service" => "obbwasm-php-api",
    "time" => gmdate("c"),
]);
