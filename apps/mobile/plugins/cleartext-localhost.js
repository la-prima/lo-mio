/**
 * Android bloquea HTTP sin TLS en builds release. Se permite solo hacia `localhost`: la build de
 * e2e habla con la API por `adb reverse` (ver src/api.ts). Producción nunca usa localhost, así que
 * no abre nada hacia afuera.
 */
const { withAndroidManifest, withDangerousMod } = require("expo/config-plugins");
const { mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const CONFIG = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="false">localhost</domain>
  </domain-config>
</network-security-config>
`;

module.exports = (config) => {
  config = withDangerousMod(config, [
    "android",
    (cfg) => {
      const dir = join(cfg.modRequest.platformProjectRoot, "app/src/main/res/xml");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "network_security_config.xml"), CONFIG);
      return cfg;
    },
  ]);
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (app) app.$["android:networkSecurityConfig"] = "@xml/network_security_config";
    return cfg;
  });
};
