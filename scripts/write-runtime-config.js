const fs = require("fs");
const path = require("path");

function parseJsonEnv(name, fallback) {
  const raw = process.env[name];

  if (!raw || raw.trim() === "") {
    return fallback;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error(`Invalid JSON in environment variable ${name}`);
    console.error(raw);
    throw error;
  }
}

const config = {
  apps: parseJsonEnv("APP_CONFIG_APPS_JSON", []),
  providers: parseJsonEnv("APP_CONFIG_PROVIDERS_JSON", []),
  branding: parseJsonEnv("APP_BRANDING_JSON", {}),
};

const fileContent =
  `window.__APP_CONFIG__ = ${JSON.stringify(config, null, 2)};\n`;

const targetPath = path.join(__dirname, "..", "public", "config.js");

fs.writeFileSync(targetPath, fileContent, "utf8");

console.log("Runtime config written to:", targetPath);
console.log(JSON.stringify(config, null, 2));