use std::env;

fn main() {
    println!("cargo:rustc-check-cfg=cfg(app_store)");
    println!("cargo:rerun-if-env-changed=PKT_APP_STORE");
    if env::var_os("PKT_APP_STORE").is_some() {
        println!("cargo:rustc-cfg=app_store");
    }

    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new()),
    )
    .expect("failed to build Tauri application manifest");
}
