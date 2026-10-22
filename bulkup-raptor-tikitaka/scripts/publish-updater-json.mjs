import { writeFile } from "node:fs/promises";

function readOption(name) {
  const optionIndex = process.argv.indexOf(name);
  return optionIndex >= 0 ? process.argv[optionIndex + 1] : undefined;
}

const releaseTag = readOption("--release-tag");
const outputPath = readOption("--output");
const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;

if (!releaseTag || !outputPath || !repository || !token) {
  throw new Error("release-tag, output, GITHUB_REPOSITORY, and GITHUB_TOKEN are required.");
}

const headers = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": "2022-11-28",
};

async function readJson(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`GitHub API request failed (${response.status}): ${url}`);
  return response.json();
}

async function readSignature(asset) {
  const response = await fetch(asset.url, {
    headers: { ...headers, Accept: "application/octet-stream" },
  });
  if (!response.ok) throw new Error(`Unable to download updater signature: ${asset.name}`);
  return (await response.text()).trim();
}

const release = await readJson(`https://api.github.com/repos/${repository}/releases/tags/${releaseTag}`);
const assetsByName = new Map(release.assets.map((asset) => [asset.name, asset]));

const platformCandidates = [
  { key: "darwin-aarch64", pattern: /aarch64\.app\.tar\.gz$/ },
  { key: "windows-x86_64", pattern: /x64-setup\.exe$/ },
];

const platforms = {};
for (const { key, pattern } of platformCandidates) {
  const installer = release.assets.find((asset) => pattern.test(asset.name));
  if (!installer) continue;

  const signature = assetsByName.get(`${installer.name}.sig`);
  if (!signature) throw new Error(`Missing updater signature for ${installer.name}`);

  platforms[key] = {
    url: installer.browser_download_url,
    signature: await readSignature(signature),
  };
}

if (Object.keys(platforms).length === 0) {
  throw new Error(`No updater artifacts were found for ${releaseTag}.`);
}

const updaterMetadata = {
  version: releaseTag.replace(/^v/, ""),
  notes: `Bulkup Raptor ${releaseTag}`,
  pub_date: release.published_at ?? new Date().toISOString(),
  platforms,
};

await writeFile(outputPath, `${JSON.stringify(updaterMetadata, null, 2)}\n`, "utf8");
console.log(`Prepared updater metadata for ${Object.keys(platforms).join(", ")}.`);
