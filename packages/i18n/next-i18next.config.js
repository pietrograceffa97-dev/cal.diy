// Bare "path" (not "node:path"): this plain .js config is pulled into
// webpack's loader pipeline by TS modules that import it (e.g.
// packages/features/auth/lib/getLocale.ts), and webpack-dev rejects the
// node:-scheme request it tries to process as a resource
// (UnhandledSchemeError → the importing route 500s). The bare builtin
// resolves identically in every runtime; node:-scheme stays fine in TS
// sources. Needed by PM Hub's dev-runtime (next dev --webpack).
const path = require("path");
const i18n = require("../../i18n.json");

/** @type {import("next-i18next").UserConfig} */
const config = {
  i18n: {
    defaultLocale: i18n.locale.source,
    locales: i18n.locale.targets.concat([i18n.locale.source]),
  },
  fallbackLng: {
    default: ["en"],
    zh: ["zh-CN"],
  },
  reloadOnPrerender: process.env.NODE_ENV !== "production",
  localePath: path.resolve(__dirname, "./locales"),
};

module.exports = config;
