import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const projectRoot = resolve(import.meta.dirname, "..");
const profilePath = process.env.PKT_APPSTORE_PROFILE;
const applicationIdentity = process.env.APPLE_APPSTORE_APPLICATION_IDENTITY;
const installerIdentity = process.env.APPLE_APPSTORE_INSTALLER_IDENTITY;
const appStoreBuildNumber = process.env.PKT_APPSTORE_BUILD_NUMBER;

for (const [name, value] of [
  ["PKT_APPSTORE_PROFILE", profilePath],
  ["APPLE_APPSTORE_APPLICATION_IDENTITY", applicationIdentity],
  ["APPLE_APPSTORE_INSTALLER_IDENTITY", installerIdentity],
]) {
  if (!value) throw new Error(`${name} is required for a Mac App Store build.`);
}

if (!existsSync(profilePath)) {
  throw new Error("PKT_APPSTORE_PROFILE does not point to a readable provisioning profile.");
}

const profileDestination = join(projectRoot, "src-tauri", "appstore", "embedded.provisionprofile");
const appBundle = join(projectRoot, "src-tauri", "target", "release", "bundle", "macos", "Bulkup Raptor.app");
const packagePath = join(projectRoot, "src-tauri", "target", "release", "bundle", "appstore", "Bulkup Raptor.pkg");
const appEntitlements = join(projectRoot, "src-tauri", "entitlements.appstore.plist");
const childEntitlements = join(projectRoot, "src-tauri", "entitlements.appstore.child.plist");
const nextEnvPath = join(projectRoot, "next-env.d.ts");
const tsconfigPath = join(projectRoot, "tsconfig.json");
const nextEnvBeforeBuild = readFileSync(nextEnvPath);
const tsconfigBeforeBuild = readFileSync(tsconfigPath);
let packageStagePath;

mkdirSync(join(projectRoot, "src-tauri", "appstore"), { recursive: true });
mkdirSync(join(projectRoot, "src-tauri", "target", "release", "bundle", "appstore"), { recursive: true });
cpSync(profilePath, profileDestination);

try {
  execFileSync(
    "npm",
    ["run", "tauri", "--", "build", "--bundles", "app", "--config", "src-tauri/tauri.appstore.conf.json"],
    {
      cwd: projectRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        PKT_APP_STORE: "1",
        PKT_NEXT_DIST_DIR: ".next-appstore",
        NEXT_PUBLIC_APP_STORE_BUILD: "1",
        APPLE_SIGNING_IDENTITY: applicationIdentity,
      },
    },
  );

  if (appStoreBuildNumber) {
    execFileSync("plutil", [
      "-replace",
      "CFBundleVersion",
      "-string",
      appStoreBuildNumber,
      join(appBundle, "Contents", "Info.plist"),
    ], { cwd: projectRoot, stdio: "inherit" });
  }

  // Tauri signs nested executables with the app's entitlements. A nested
  // executable has no bundle location for an embedded profile, so it must not
  // carry the app identifier entitlement. Sign inner code first, then the app.
  const nodeExecutable = join(appBundle, "Contents", "MacOS", "node");
  if (existsSync(nodeExecutable)) {
    execFileSync("codesign", [
      "--force",
      "--options",
      "runtime",
      "--timestamp",
      "--generate-entitlement-der",
      "--entitlements",
      childEntitlements,
      "--sign",
      applicationIdentity,
      nodeExecutable,
    ], { cwd: projectRoot, stdio: "inherit" });
  }

  const nativeAddonDirectory = join(appBundle, "Contents", "Resources", "next");
  if (existsSync(nativeAddonDirectory)) {
    const nativeAddons = execFileSync("find", [nativeAddonDirectory, "-type", "f", "-name", "*.node"], {
      cwd: projectRoot,
      encoding: "utf8",
    }).trim().split("\n").filter(Boolean);
    for (const nativeAddon of nativeAddons.sort((a, b) => b.length - a.length)) {
      execFileSync("codesign", [
        "--force",
        "--options",
        "runtime",
        "--timestamp",
        "--sign",
        applicationIdentity,
        nativeAddon,
      ], { cwd: projectRoot, stdio: "inherit" });
    }
  }

  execFileSync("codesign", [
    "--force",
    "--options",
    "runtime",
    "--timestamp",
    "--generate-entitlement-der",
    "--entitlements",
    appEntitlements,
    "--sign",
    applicationIdentity,
    appBundle,
  ], { cwd: projectRoot, stdio: "inherit" });

  // productbuild can produce a BOM containing the app's files but an empty
  // Payload when it packages the Tauri output directory directly. Recreate
  // the app in a clean temporary stage first, preserving code signatures and
  // the embedded provisioning profile without copying Finder metadata.
  packageStagePath = mkdtempSync(join(tmpdir(), "pkt-appstore-package-"));
  const archivePath = join(packageStagePath, "app.tar");
  const stagedAppBundle = join(packageStagePath, basename(appBundle));
  const cleanCopyEnvironment = { ...process.env, COPYFILE_DISABLE: "1" };
  execFileSync(
    "tar",
    ["-C", dirname(appBundle), "-cf", archivePath, basename(appBundle)],
    { cwd: projectRoot, stdio: "inherit", env: cleanCopyEnvironment },
  );
  execFileSync("tar", ["-C", packageStagePath, "-xf", archivePath], {
    cwd: projectRoot,
    stdio: "inherit",
    env: cleanCopyEnvironment,
  });
  execFileSync("codesign", ["--verify", "--deep", "--strict", stagedAppBundle], {
    cwd: projectRoot,
    stdio: "inherit",
  });

  execFileSync(
    "xcrun",
    ["productbuild", "--sign", installerIdentity, "--component", stagedAppBundle, "/Applications", packagePath],
    { cwd: projectRoot, stdio: "inherit" },
  );
  console.log(`Created Mac App Store package: ${packagePath}`);
} finally {
  rmSync(profileDestination, { force: true });
  if (packageStagePath) rmSync(packageStagePath, { recursive: true, force: true });
  writeFileSync(nextEnvPath, nextEnvBeforeBuild);
  writeFileSync(tsconfigPath, tsconfigBeforeBuild);
}
