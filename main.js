const { readFileSync } = require("fs");
const { execSync } = require("child_process");

function getVersion(packageJsonPath) {
  return JSON.parse(fs.readFileSync(packageJsonPath)).version;
}

