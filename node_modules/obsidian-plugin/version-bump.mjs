/**
 * Synchronise manifest.json.version et versions.json après bump de package.json.
 * Appelé par Release-Plugin.ps1 avec env npm_package_version=x.y.z (depuis le dossier plugin).
 * Copier ce fichier à côté de manifest.json / versions.json du plugin cible.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const targetVersion = process.env.npm_package_version;
if (!targetVersion || !/^\d+\.\d+\.\d+$/.test(targetVersion)) {
  console.error("npm_package_version manquant ou invalide (attendu: x.y.z).");
  process.exit(1);
}

const manifestPath = path.join(__dirname, "manifest.json");
const versionsPath = path.join(__dirname, "versions.json");
const rootDir = path.join(__dirname, "..");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const { minAppVersion } = manifest;
manifest.version = targetVersion;
const manifestBody = `${JSON.stringify(manifest, null, "\t")}\n`;
writeFileSync(manifestPath, manifestBody);
writeFileSync(path.join(rootDir, "manifest.json"), manifestBody);

const versions = JSON.parse(readFileSync(versionsPath, "utf8"));
versions[targetVersion] = minAppVersion;
const versionsBody = `${JSON.stringify(versions, null, "\t")}\n`;
writeFileSync(versionsPath, versionsBody);
writeFileSync(path.join(rootDir, "versions.json"), versionsBody);

console.log(`manifest.json → ${targetVersion}, versions.json["${targetVersion}"] → ${minAppVersion} (plugin + racine)`);
