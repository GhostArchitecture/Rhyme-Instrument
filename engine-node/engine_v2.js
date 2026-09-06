/* engine_v2.js — node scaffold around the shared browser core (engine_core.js). Single source; the tome ships the same block. */
const fs = require("fs"), path = require("path");
const { g2p, EXCEPTIONS, LETTERS, LEXICON, FILLERS, VOWEL_NAMES } = require("./rule_g2p_v1.js");
const REPO_ROOT = path.join(__dirname, "..");
global.fetch = (url) => {
  const f = path.join(REPO_ROOT, url.replace("./", ""));
  return Promise.resolve({ ok: fs.existsSync(f), json: () => Promise.resolve(JSON.parse(fs.readFileSync(f, "utf8"))), text: () => Promise.resolve(fs.readFileSync(f, "utf8")) });
};
const core = eval(fs.readFileSync(path.join(__dirname, "engine_core.js"), "utf8") + "\n;({ E2, setOverrides: o => { OVERRIDES = o || {}; } })");
module.exports = { VOWEL_NAMES, E2: core.E2, setOverrides: core.setOverrides, load: () => core.E2.load(), ...core.E2 };
