/**
 * Increment package version and create release
 * @example
 *
 * createVersion.js minor "version name" "what's new in this version"
 */

const CONFIG = {
  owner: "NoamRa",
  repo: "create-version-demo",
  packageJsonIndent: 2,
};

const { promisify } = require("util");
const fs = require("fs");
const path = require("path");
const cp = require("child_process");
const https = require("https");

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const exists = promisify(fs.stat);
const exec = promisify(cp.exec);

(async function main() {
  try {
    const { bumpType, name, body } = getArgs();
    await setCredentials();
    const semver = await updatePackageFile(
      await getPackageJsonPath(),
      bumpType,
    );
    await exec(`git commit -am "update version to ${semver}"`);
    await exec("git push");
    await createRelease(`v${semver}`, name, body);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();

//
function getArgs() {
  const args = process.argv.slice(2);
  if (args.length !== 2) {
    throw `Should get three arguments: bump type, and pull request body. Got ${
      args.length
    } arguments:\n${args.join("\n")}`;
  }

  const [bumpType, body] = args;
  if (!["major", "minor", "patch"].includes(bumpType)) {
    throw `Bump type is invalid, must be one either 'major', 'minor', or 'patch'. Got ${bumpType}`;
  }

  const name = substringBetween("# VERSION NAME", body, "---");
  const description = substringBetween("# VERSION DESCRIPTION", body, "---");
  if (name.length < 4) {
    throw `Name is too short, must be at least 4 characters. Got name ${name}`;
  }
  if (name.indexOf("\n") !== -1) {
    throw `Name has line brake inside... BTW it's ${name}, and the line break is at ${name.indexOf(
      "\n",
    )}`;
  }
  if (body.length < 6) {
    throw `Body is too short, must be at least 6 characters. Got body\n${body}`;
  }

  return { bumpType, name, description };
}

function bump(semver, bumpType) {
  const [major, minor, patch] = semver;
  if (bumpType === "major") {
    return `${major + 1}.0.0`;
  } else if (bumpType === "minor") {
    return `${major}.${minor + 1}.0`;
  } else if (bumpType === "patch") {
    return `${major + 1}.${minor}.${patch + 1}`;
  }
  throw `Failed to match bump type. Got ${bumpType}`;
}

async function getPackageJsonPath() {
  const package = "package.json";
  const paths = [
    path.join(__dirname, package),
    path.join(__dirname, "..", package),
    path.join(__dirname, "..", "..", package),
  ];

  for (const aPath in paths) {
    if (await exists(aPath)) {
      return aPath;
    }
  }
  console.log(await exec("pwd"));
  console.log(await exec("ls"));
  throw `Failed to find ${package} file. Searched\n${paths.join("\n")}`;
}

async function updatePackageFile(packageJsonPath, bumpType) {
  const packageJson = JSON.parse(await readFile(packageJsonPath));
  packageJson.version = bump(packageJson.version, bumpType);
  await writeFile(JSON.stringify(packageJson, null, CONFIG.indent));
  return semver;
}

async function setCredentials() {
  await exec(`git config user.name "Noam Raby"`);
  await exec(`git config user.email "noamraby@gmail.com"`);
}

async function createRelease(tag, name, body) {
  const options = {
    url: "api.github.com",
    port: "80",
    path: `/repos/${CONFIG.owner}/${CONFIG.repo}/releases`,
    method: "POST",
    headers: {
      accept: "application/vnd.github.v3+json",
    },
  };

  const data = JSON.stringify({
    tag_name: tag,
    name,
    body,
  });

  return await httpsRequest(options, data);
}

async function httpsRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const request = https.request(options, function (response) {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        return reject(new Error(`statusCode = ${response.statusCode}`));
      }

      const body = [];
      response.on("data", (chunk) => {
        body.push(chunk);
      });
      response.on("end", () => {
        try {
          body = JSON.parse(Buffer.concat(body).toString());
        } catch (err) {
          reject(err);
        }
        resolve(body);
      });
    });
    request.on("error", (err) => {
      reject(err);
    });

    if (postData) {
      request.write(postData);
    }

    request.end();
  });
}

function substringBetween(before, string, after) {
  return string.split(before)[1].split(after)[0].trim();
}
