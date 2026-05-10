<?php
declare(strict_types=1);

require_once __DIR__ . "/common.php";

/**
 * Chemin du fichier journal mail (config mail_debug_log_file ou app/data/logs/obbwasm-mail.log).
 */
function auth_mail_log_file(array $cfg): string {
    $p = trim((string)($cfg["mail_debug_log_file"] ?? ""));
    if ($p !== "") {
        return $p;
    }
    return data_path("logs/obbwasm-mail.log");
}

function auth_mail_log(string $line, array $cfg): void {
    if (array_key_exists("mail_debug_log_enabled", $cfg) && !$cfg["mail_debug_log_enabled"]) {
        return;
    }
    $path = auth_mail_log_file($cfg);
    $dir = dirname($path);
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    $ts = gmdate("Y-m-d\TH:i:s\Z");
    @file_put_contents($path, "[{$ts}] {$line}\n", FILE_APPEND | LOCK_EX);
}

function auth_load_config(): array {
    $local = __DIR__ . DIRECTORY_SEPARATOR . "auth-config.local.php";
    $sample = __DIR__ . DIRECTORY_SEPARATOR . "auth-config.sample.php";
    $defaults = file_exists($sample) ? require $sample : [];
    if (!is_array($defaults)) {
        $defaults = [];
    }
    if (file_exists($local)) {
        $over = require $local;
        if (is_array($over)) {
            return array_replace_recursive($defaults, $over);
        }
    }
    return $defaults;
}

function auth_is_admin_email(string $email, array $cfg): bool {
    $admin = strtolower(trim((string)($cfg["admin_email"] ?? "")));
    return $admin !== "" && strtolower(trim($email)) === $admin;
}

function auth_session_start_safe(): void {
    $cfg = auth_load_config();
    if (session_status() === PHP_SESSION_NONE) {
        $secure = (bool)($cfg["session_cookie_secure"] ?? false);
        $same = (string)($cfg["session_cookie_samesite"] ?? "Lax");
        session_set_cookie_params([
            "lifetime" => 60 * 60 * 24 * 14,
            "path" => "/",
            "secure" => $secure,
            "httponly" => true,
            "samesite" => $same,
        ]);
        session_name("obbwasm_sid");
        session_start();
    }
}

function auth_current_email(): ?string {
    auth_session_start_safe();
    $e = $_SESSION["email"] ?? null;
    return is_string($e) && $e !== "" ? $e : null;
}

function auth_require_login(): string {
    $e = auth_current_email();
    if ($e === null) {
        json_response(["ok" => false, "error" => "Non authentifie"], 401);
    }
    return $e;
}

function auth_login_email(string $email): void {
    auth_session_start_safe();
    $_SESSION["email"] = strtolower(trim($email));
    $_SESSION["login_at"] = gmdate("c");
}

function auth_logout(): void {
    auth_session_start_safe();
    $_SESSION = [];
    if (ini_get("session.use_cookies")) {
        $p = session_get_cookie_params();
        setcookie(session_name(), "", time() - 42000, $p["path"], $p["domain"], $p["secure"], $p["httponly"]);
    }
    session_destroy();
}

function auth_rate_limit_key(string $email): string {
    $ip = (string)($_SERVER["REMOTE_ADDR"] ?? "0");
    return strtolower(trim($email)) . "|" . $ip;
}

function auth_rate_limit_ok(string $key): bool {
    $path = data_path("auth/rate-limit.json");
    $data = read_json_file($path, []);
    $now = time();
    $last = (int)($data[$key] ?? 0);
    if ($now - $last < 45) {
        return false;
    }
    $data[$key] = $now;
    foreach ($data as $k => $t) {
        if ($now - (int)$t > 3600) {
            unset($data[$k]);
        }
    }
    auth_safe_write_json($path, $data);
    return true;
}

function auth_safe_write_json(string $path, array $data): void {
    $dir = dirname($path);
    if (!is_dir($dir)) {
        mkdir($dir, 0777, true);
    }
    $encoded = json_encode(
        $data,
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT | JSON_INVALID_UTF8_SUBSTITUTE
    );
    if ($encoded !== false) {
        @file_put_contents($path, $encoded);
    }
}

function auth_store_magic_token(string $tokenPlain, string $email, int $ttlSeconds = 900): void {
    $path = data_path("auth/magic-tokens.json");
    $data = read_json_file($path, []);
    $hash = hash("sha256", $tokenPlain);
    $data[$hash] = [
        "email" => strtolower(trim($email)),
        "exp" => time() + $ttlSeconds,
        "used" => false,
    ];
    auth_safe_write_json($path, $data);
}

function auth_consume_magic_token(string $tokenPlain): ?string {
    $path = data_path("auth/magic-tokens.json");
    $data = read_json_file($path, []);
    $hash = hash("sha256", $tokenPlain);
    $row = $data[$hash] ?? null;
    if (!is_array($row)) {
        return null;
    }
    if (!empty($row["used"]) || (int)($row["exp"] ?? 0) < time()) {
        return null;
    }
    $email = (string)($row["email"] ?? "");
    if ($email === "") {
        return null;
    }
    $data[$hash]["used"] = true;
    auth_safe_write_json($path, $data);
    return $email;
}

function auth_send_mail_smtp_or_mail(string $to, string $subject, string $bodyText, array $cfg): bool {
    $smtp = $cfg["smtp"] ?? [];
    $host = (string)($smtp["host"] ?? "");
    if ($host !== "") {
        auth_mail_log("SMTP send start to={$to}", $cfg);
        $ok = auth_smtp_send($to, $subject, $bodyText, $cfg);
        auth_mail_log("SMTP send end to={$to} ok=" . ($ok ? "1" : "0"), $cfg);
        return $ok;
    }
    $from = (string)($smtp["from_email"] ?? "noreply@localhost");
    $headers = "From: " . $from . "\r\nContent-Type: text/plain; charset=UTF-8\r\n";
    auth_mail_log("mail() to={$to}", $cfg);
    $ok = @mail($to, $subject, $bodyText, $headers);
    auth_mail_log("mail() result ok=" . ($ok ? "1" : "0"), $cfg);
    return $ok;
}

/**
 * Lit une reponse SMTP complete (EHLO et autres peuvent etre multi-lignes 250-... puis 250 ...).
 */
function auth_smtp_read_response($fp): string {
    $out = "";
    while (!feof($fp)) {
        $line = fgets($fp, 8192);
        if ($line === false) {
            break;
        }
        $out .= $line;
        if (strlen($line) >= 4 && $line[3] === " ") {
            break;
        }
    }
    return $out;
}

function auth_smtp_code_ok(string $response): bool {
    return strlen($response) >= 3 && ($response[0] === "2" || $response[0] === "3");
}

/**
 * Connexion TCP + banniere + EHLO (+ STARTTLS si port STARTTLS).
 *
 * @return array{0: resource, 1: Closure(string):void}|null
 */
function auth_smtp_session_init(array $cfg): ?array {
    $smtp = $cfg["smtp"] ?? [];
    $host = (string)($smtp["host"] ?? "");
    $port = (int)($smtp["port"] ?? 587);
    $enc = strtolower((string)($smtp["encryption"] ?? "tls"));
    $remote = ($enc === "ssl") ? "ssl://" . $host . ":" . $port : $host . ":" . $port;
    $verifyPeer = array_key_exists("ssl_verify_peer", $smtp) ? (bool)$smtp["ssl_verify_peer"] : true;
    $ctx = stream_context_create([
        "ssl" => [
            "verify_peer" => $verifyPeer,
            "verify_peer_name" => $verifyPeer,
            "allow_self_signed" => !$verifyPeer,
        ],
    ]);
    $fp = @stream_socket_client($remote, $errno, $errstr, 30, STREAM_CLIENT_CONNECT, $ctx);
    if (!$fp) {
        $msg = "connect FAIL errno={$errno} errstr={$errstr} remote={$remote}";
        error_log("OBBWASM SMTP " . $msg);
        auth_mail_log("SMTP " . $msg, $cfg);
        return null;
    }
    stream_set_timeout($fp, 30);
    $write = function (string $cmd) use ($fp): void {
        fwrite($fp, $cmd . "\r\n");
    };
    $banner = auth_smtp_read_response($fp);
    if (!auth_smtp_code_ok($banner)) {
        $b = preg_replace("/\s+/", " ", trim(str_replace(["\r", "\n"], " | ", $banner)));
        error_log("OBBWASM SMTP banner: " . trim($banner));
        auth_mail_log("SMTP banner FAIL " . $b, $cfg);
        fclose($fp);
        return null;
    }
    $bannerFirst = (string)(preg_split("/\r\n|\n|\r/", $banner, 2)[0] ?? "");
    auth_mail_log("SMTP banner OK firstline=" . trim($bannerFirst), $cfg);
    $write("EHLO obbwasm");
    $ehlo = auth_smtp_read_response($fp);
    if (!auth_smtp_code_ok($ehlo)) {
        auth_mail_log("SMTP EHLO FAIL " . preg_replace("/\s+/", " ", trim(str_replace(["\r", "\n"], " | ", $ehlo))), $cfg);
        error_log("OBBWASM SMTP EHLO: " . trim($ehlo));
        fclose($fp);
        return null;
    }
    if ($enc === "tls") {
        $write("STARTTLS");
        $st = auth_smtp_read_response($fp);
        if (!auth_smtp_code_ok($st)) {
            auth_mail_log("SMTP STARTTLS FAIL " . trim(str_replace(["\r", "\n"], " ", $st)), $cfg);
            error_log("OBBWASM SMTP STARTTLS: " . trim($st));
            fclose($fp);
            return null;
        }
        $crypto = STREAM_CRYPTO_METHOD_TLS_CLIENT;
        if (defined("STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT")) {
            $crypto |= STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT;
        }
        if (!stream_socket_enable_crypto($fp, true, $crypto)) {
            auth_mail_log("SMTP stream_socket_enable_crypto FAIL", $cfg);
            error_log("OBBWASM SMTP: stream_socket_enable_crypto a echoue");
            fclose($fp);
            return null;
        }
        $write("EHLO obbwasm");
        $ehlo2 = auth_smtp_read_response($fp);
        if (!auth_smtp_code_ok($ehlo2)) {
            auth_mail_log("SMTP EHLO apres TLS FAIL " . trim(str_replace(["\r", "\n"], " ", $ehlo2)), $cfg);
            error_log("OBBWASM SMTP EHLO apres TLS: " . trim($ehlo2));
            fclose($fp);
            return null;
        }
    }
    return [$fp, $write];
}

function auth_smtp_send(string $to, string $subject, string $bodyText, array $cfg): bool {
    $smtp = $cfg["smtp"] ?? [];
    $host = (string)($smtp["host"] ?? "");
    $port = (int)($smtp["port"] ?? 587);
    $user = trim((string)($smtp["user"] ?? ""));
    $pass = (string)($smtp["password"] ?? "");
    $from = (string)($smtp["from_email"] ?? "noreply@localhost");
    if ($user === "" && $pass !== "") {
        $user = $from;
    }
    $enc = strtolower((string)($smtp["encryption"] ?? "tls"));
    auth_mail_log(
        "SMTP connect target={$host}:{$port} enc={$enc} authUser=" . ($user !== "" ? "yes" : "no") . " pass=" . ($pass !== "" ? "yes" : "no"),
        $cfg,
    );
    $session = auth_smtp_session_init($cfg);
    if ($session === null) {
        return false;
    }
    /** @var resource $fp */
    $fp = $session[0];
    $write = $session[1];
    if ($user !== "" && $pass !== "") {
        $authKind = strtolower((string)($smtp["auth"] ?? "login"));
        if ($authKind === "plain" || $authKind === "plain_user") {
            $attempts = [];
            if ($authKind === "plain_user") {
                $attempts[] = ["plain_user", $user . "\0" . $user . "\0" . $pass];
            } else {
                $attempts[] = ["standard", "\0" . $user . "\0" . $pass];
                $attempts[] = ["plain_user", $user . "\0" . $user . "\0" . $pass];
            }
            foreach ($attempts as $idx => $attempt) {
                [$label, $inner] = $attempt;
                if ($idx > 0) {
                    fclose($fp);
                    auth_mail_log("SMTP reconnexion pour essai AUTH PLAIN suivant ({$label})", $cfg);
                    $session = auth_smtp_session_init($cfg);
                    if ($session === null) {
                        return false;
                    }
                    $fp = $session[0];
                    $write = $session[1];
                }
                $write("AUTH PLAIN " . base64_encode($inner));
                $ap = auth_smtp_read_response($fp);
                if (auth_smtp_code_ok($ap)) {
                    auth_mail_log("SMTP AUTH PLAIN OK ({$label})", $cfg);
                    break;
                }
                $apShort = trim(str_replace(["\r", "\n"], " ", $ap));
                auth_mail_log("SMTP AUTH PLAIN FAIL ({$label}) {$apShort}", $cfg);
                error_log("OBBWASM SMTP AUTH PLAIN {$label}: " . trim($ap));
                if ($idx === count($attempts) - 1) {
                    fclose($fp);
                    return false;
                }
                if (strpos($ap, "535") === false) {
                    fclose($fp);
                    return false;
                }
            }
        } else {
            $write("AUTH LOGIN");
            $a1 = auth_smtp_read_response($fp);
            if (!auth_smtp_code_ok($a1)) {
                auth_mail_log("SMTP AUTH LOGIN prompt FAIL " . trim(str_replace(["\r", "\n"], " ", $a1)), $cfg);
                error_log("OBBWASM SMTP AUTH LOGIN: " . trim($a1));
                fclose($fp);
                return false;
            }
            $write(base64_encode($user));
            $a2 = auth_smtp_read_response($fp);
            if (!auth_smtp_code_ok($a2)) {
                auth_mail_log("SMTP AUTH user step FAIL " . trim(str_replace(["\r", "\n"], " ", $a2)), $cfg);
                error_log("OBBWASM SMTP AUTH user: " . trim($a2));
                fclose($fp);
                return false;
            }
            $write(base64_encode($pass));
            $a3 = auth_smtp_read_response($fp);
            if (!auth_smtp_code_ok($a3)) {
                auth_mail_log("SMTP AUTH pass step FAIL " . trim(str_replace(["\r", "\n"], " ", $a3)), $cfg);
                error_log("OBBWASM SMTP AUTH pass: " . trim($a3));
                fclose($fp);
                return false;
            }
            auth_mail_log("SMTP AUTH LOGIN OK", $cfg);
        }
    }
    $write("MAIL FROM:<" . $from . ">");
    $mf = auth_smtp_read_response($fp);
    if (!auth_smtp_code_ok($mf)) {
        auth_mail_log("SMTP MAIL FROM FAIL " . trim(str_replace(["\r", "\n"], " ", $mf)), $cfg);
        error_log("OBBWASM SMTP MAIL FROM: " . trim($mf));
        fclose($fp);
        return false;
    }
    $write("RCPT TO:<" . $to . ">");
    $rc = auth_smtp_read_response($fp);
    if (!auth_smtp_code_ok($rc)) {
        auth_mail_log("SMTP RCPT TO FAIL " . trim(str_replace(["\r", "\n"], " ", $rc)), $cfg);
        error_log("OBBWASM SMTP RCPT TO: " . trim($rc));
        fclose($fp);
        return false;
    }
    $extraRcpt = trim((string)($smtp["diagnostic_rcpt"] ?? ""));
    if ($extraRcpt !== "" && filter_var($extraRcpt, FILTER_VALIDATE_EMAIL)) {
        $write("RCPT TO:<" . $extraRcpt . ">");
        $rcx = auth_smtp_read_response($fp);
        if (!auth_smtp_code_ok($rcx)) {
            auth_mail_log("SMTP RCPT TO diagnostic FAIL " . trim(str_replace(["\r", "\n"], " ", $rcx)), $cfg);
            error_log("OBBWASM SMTP RCPT diagnostic: " . trim($rcx));
            fclose($fp);
            return false;
        }
        auth_mail_log("SMTP copie diagnostic aussi vers {$extraRcpt}", $cfg);
    }
    $write("DATA");
    $dt = auth_smtp_read_response($fp);
    if (!auth_smtp_code_ok($dt)) {
        auth_mail_log("SMTP DATA prompt FAIL " . trim(str_replace(["\r", "\n"], " ", $dt)), $cfg);
        error_log("OBBWASM SMTP DATA: " . trim($dt));
        fclose($fp);
        return false;
    }
    $fromName = trim((string)($smtp["from_name"] ?? ""));
    $fromLine = $fromName !== ""
        ? "From: \"" . str_replace(["\"", "\r", "\n"], "", $fromName) . "\" <" . $from . ">\r\n"
        : "From: <" . $from . ">\r\n";
    $atPos = strrpos($from, "@");
    $domain = $atPos !== false ? substr($from, $atPos + 1) : "";
    $msgId = "<obbwasm-" . bin2hex(random_bytes(8)) . "@" . ($domain !== "" ? $domain : "local") . ">";
    $msg = "Subject: " . $subject . "\r\n";
    $msg .= $fromLine;
    $msg .= "To: " . $to . "\r\n";
    $msg .= "Message-ID: " . $msgId . "\r\n";
    $msg .= "MIME-Version: 1.0\r\n";
    $msg .= "Content-Type: text/plain; charset=UTF-8\r\n\r\n";
    $msg .= str_replace("\n.", "\n..", $bodyText) . "\r\n";
    $write($msg . ".");
    $sent = auth_smtp_read_response($fp);
    if (!auth_smtp_code_ok($sent)) {
        auth_mail_log("SMTP apres corps FAIL " . trim(str_replace(["\r", "\n"], " ", $sent)), $cfg);
        error_log("OBBWASM SMTP fin DATA: " . trim($sent));
        fclose($fp);
        return false;
    }
    $sentOneLine = trim(preg_replace("/\s+/", " ", str_replace(["\r", "\n"], " | ", $sent)));
    auth_mail_log("SMTP message accepte par le serveur (file / id Exim si present): " . $sentOneLine, $cfg);
    $write("QUIT");
    auth_smtp_read_response($fp);
    fclose($fp);
    return true;
}
