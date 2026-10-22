use std::{
    path::PathBuf,
    process::Command,
    sync::{Arc, Mutex},
};

// 배포 빌드에서 실행되는 Next sidecar 초기화에만 필요한 import다.
// 개발 모드에서는 사용하지 않으므로 조건부로 가져와 Rust warning을 막는다.
#[cfg(any(not(debug_assertions), test))]
use std::{fs, path::Path};

#[cfg(not(debug_assertions))]
use std::{fs::OpenOptions, io::Write, net::TcpListener};

use tauri::{AppHandle, Manager, WebviewWindow};
use tauri_plugin_shell::process::CommandChild;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init());

    // Mac App Store releases must use Store-managed updates. Direct-distribution
    // releases retain the signed GitHub Release updater.
    #[cfg(all(desktop, not(app_store)))]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());

    let app = builder
        .setup(|_app| {
            #[cfg(not(debug_assertions))]
            start_next_sidecar(_app.handle())?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            window_minimize,
            window_toggle_maximize,
            window_close,
            window_is_maximized,
            open_directory,
        ])
        .build(tauri::generate_context!())
        .expect("error while running Bulkup Raptor");

    app.run(|app, event| match event {
        tauri::RunEvent::ExitRequested { .. }
        | tauri::RunEvent::WindowEvent {
            event: tauri::WindowEvent::CloseRequested { .. },
            ..
        } => stop_next_server(app),
        _ => {}
    });
}

fn stop_next_server<R: tauri::Runtime>(app: &AppHandle<R>) {
    if let Some(server) = app.try_state::<NextServer>() {
        if let Some(child) = server.child.lock().expect("sidecar lock").take() {
            let _ = child.kill();
        }
    }
}

#[tauri::command]
fn window_minimize(window: WebviewWindow) -> Result<(), String> {
    window.minimize().map_err(|error| error.to_string())
}

#[tauri::command]
fn window_toggle_maximize(window: WebviewWindow) -> Result<bool, String> {
    let maximized = window.is_maximized().map_err(|error| error.to_string())?;
    if maximized {
        window.unmaximize().map_err(|error| error.to_string())?;
        Ok(false)
    } else {
        window.maximize().map_err(|error| error.to_string())?;
        Ok(true)
    }
}

#[tauri::command]
fn window_close(app: AppHandle, window: WebviewWindow) -> Result<(), String> {
    stop_next_server(&app);
    window.close().map_err(|error| error.to_string())?;
    app.exit(0);
    Ok(())
}

#[tauri::command]
fn window_is_maximized(window: WebviewWindow) -> Result<bool, String> {
    window.is_maximized().map_err(|error| error.to_string())
}

#[tauri::command]
fn open_directory(app: AppHandle, directory: Option<String>) -> Result<(), String> {
    let directory = match directory {
        Some(directory) => PathBuf::from(directory),
        None => app
            .path()
            .download_dir()
            .map_err(|error| error.to_string())?,
    };
    if !directory.is_dir() {
        return Err("열 수 있는 폴더를 찾지 못했습니다.".to_string());
    }
    #[cfg(target_os = "macos")]
    let mut command = Command::new("open");
    #[cfg(target_os = "windows")]
    let mut command = Command::new("explorer");
    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    let mut command = Command::new("xdg-open");

    command
        .arg(directory)
        .spawn()
        .map(|_| ())
        .map_err(|error| error.to_string())
}

struct NextServer {
    child: Arc<Mutex<Option<CommandChild>>>,
}

#[cfg(any(not(debug_assertions), test))]
fn sqlite_sidecar_path(database_path: &Path, suffix: &str) -> PathBuf {
    let file_name = database_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("pkt-study.db");
    database_path.with_file_name(format!("{file_name}{suffix}"))
}

#[cfg(any(not(debug_assertions), test))]
fn replace_database_with_packaged_seed(
    data_dir: &Path,
    database_path: &Path,
    packaged_database_path: &Path,
) -> std::io::Result<()> {
    let staged_database_path = data_dir.join("pkt-study.db.seed-sync");
    if staged_database_path.exists() {
        fs::remove_file(&staged_database_path)?;
    }
    fs::copy(packaged_database_path, &staged_database_path)?;

    if database_path.exists() {
        fs::copy(
            database_path,
            data_dir.join("pkt-study.db.before-seed-sync"),
        )?;
    }

    for suffix in ["-wal", "-shm"] {
        let sidecar_path = sqlite_sidecar_path(database_path, suffix);
        if sidecar_path.exists() {
            fs::copy(
                &sidecar_path,
                data_dir.join(format!("pkt-study.db{suffix}.before-seed-sync")),
            )?;
            fs::remove_file(sidecar_path)?;
        }
    }

    if database_path.exists() {
        fs::remove_file(database_path)?;
    }
    fs::rename(staged_database_path, database_path)?;
    Ok(())
}

#[cfg(not(debug_assertions))]
fn start_next_sidecar<R: tauri::Runtime>(app_handle: &tauri::AppHandle<R>) -> tauri::Result<()> {
    use std::{thread, time::Duration};
    use tauri_plugin_shell::ShellExt;

    let app: tauri::AppHandle<R> = (*app_handle).clone();
    let next_port = TcpListener::bind(("127.0.0.1", 0))
        .and_then(|listener| listener.local_addr())
        .map(|address| address.port())
        .map_err(|error| {
            tauri::Error::Anyhow(
                std::io::Error::new(
                    std::io::ErrorKind::AddrNotAvailable,
                    format!("failed to allocate Next.js port: {error}"),
                )
                .into(),
            )
        })?;
    let resource_dir = match app.path().resource_dir() {
        Ok(path) => path,
        Err(error) => {
            let fallback = std::env::current_exe()
                .ok()
                .and_then(|path| path.parent().map(|dir| dir.to_path_buf()))
                .and_then(|macos_dir| macos_dir.parent().map(|dir| dir.join("Resources")));
            if let Some(path) = fallback.filter(|path| path.is_dir()) {
                eprintln!(
                    "resource directory lookup failed ({error}); using {}",
                    path.display()
                );
                path
            } else {
                eprintln!("resource directory lookup failed: {error}");
                return Err(error);
            }
        }
    };
    let next_dir = resource_dir.join("next");
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|error| tauri::Error::Anyhow(error.into()))?;
    std::fs::create_dir_all(&data_dir).map_err(|error| tauri::Error::Anyhow(error.into()))?;
    let database_path = data_dir.join("pkt-study.db");
    let packaged_database_path = next_dir.join(".data").join("pkt-study.db");
    let seed_version_path = data_dir.join("pkt-study-seed-version");
    let seed_version = env!("CARGO_PKG_VERSION");
    let installed_seed_version = std::fs::read_to_string(&seed_version_path).unwrap_or_default();
    if packaged_database_path.exists()
        && (!database_path.exists() || installed_seed_version.trim() != seed_version)
    {
        replace_database_with_packaged_seed(&data_dir, &database_path, &packaged_database_path)
            .map_err(|error| tauri::Error::Anyhow(error.into()))?;
        std::fs::write(&seed_version_path, seed_version)
            .map_err(|error| tauri::Error::Anyhow(error.into()))?;
        eprintln!(
            "synchronized user SQLite database with packaged local seed v{seed_version}: {}",
            database_path.display()
        );
    }
    eprintln!("resource directory: {}", resource_dir.display());
    eprintln!("next directory: {}", next_dir.display());
    eprintln!("SQLite data directory: {}", data_dir.display());
    let sidecar = match app.shell().sidecar("node") {
        Ok(command) => command,
        Err(error) => {
            eprintln!("node sidecar lookup failed: {error}");
            return Err(tauri::Error::Anyhow(error.into()));
        }
    };
    let (mut events, child) = sidecar
        .args(["server.js"])
        .current_dir(next_dir)
        .env("HOSTNAME", "127.0.0.1")
        .env("PORT", next_port.to_string())
        .env("NODE_ENV", "production")
        .env("PKT_STUDY_DESKTOP", "1")
        .env("PKT_STUDY_DATA_DIR", data_dir.to_string_lossy().to_string())
        .env(
            "PKT_STUDY_SEED_DB",
            database_path.to_string_lossy().to_string(),
        )
        .spawn()
        .map_err(|error| {
            eprintln!("node sidecar spawn failed: {error}");
            tauri::Error::Anyhow(error.into())
        })?;

    let child = Arc::new(Mutex::new(Some(child)));
    app.manage(NextServer {
        child: Arc::clone(&child),
    });

    let Some(window) = app.get_webview_window("main") else {
        return Ok(());
    };
    let log_path = std::env::temp_dir().join("bulkup-raptor-next.log");
    let event_window = window.clone();
    tauri::async_runtime::spawn(async move {
        let mut log = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)
            .ok();
        while let Some(event) = events.recv().await {
            match event {
                tauri_plugin_shell::process::CommandEvent::Stderr(line) => {
                    let message = String::from_utf8_lossy(&line);
                    if let Some(log) = log.as_mut() {
                        let _ = writeln!(log, "[stderr] {message}");
                    }
                    let _ = event_window.eval(
                        "document.querySelector('.status').textContent = 'Next 서버 오류 로그가 기록되었습니다.'",
                    );
                }
                tauri_plugin_shell::process::CommandEvent::Error(error) => {
                    if let Some(log) = log.as_mut() {
                        let _ = writeln!(log, "[error] {error}");
                    }
                    let _ = event_window.eval(
                        "document.querySelector('.status').textContent = 'Next 서버 실행 오류가 발생했습니다.'",
                    );
                }
                tauri_plugin_shell::process::CommandEvent::Terminated(payload) => {
                    if let Some(log) = log.as_mut() {
                        let _ = writeln!(
                            log,
                            "[terminated] code={:?} signal={:?}",
                            payload.code, payload.signal
                        );
                    }
                    let _ = event_window.eval(
                        "document.querySelector('.status').textContent = 'Next 서버가 종료되었습니다. 로그를 확인하세요.'",
                    );
                    break;
                }
                tauri_plugin_shell::process::CommandEvent::Stdout(line) => {
                    if let Some(log) = log.as_mut() {
                        let _ = writeln!(log, "[stdout] {}", String::from_utf8_lossy(&line));
                    }
                }
                _ => {}
            }
        }
    });

    thread::spawn(move || {
        for _ in 0..120 {
            if std::net::TcpStream::connect(("127.0.0.1", next_port)).is_ok() {
                let _ = window.eval(&format!(
                    "window.location.replace('http://127.0.0.1:{next_port}')"
                ));
                return;
            }
            thread::sleep(Duration::from_millis(250));
        }
        let _ = window
            .eval("document.querySelector('.status').textContent = '서버를 시작하지 못했습니다.'");
    });

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::replace_database_with_packaged_seed;
    use std::{
        fs,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn seed_sync_replaces_database_and_removes_stale_sidecars() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock should be after epoch")
            .as_nanos();
        let test_dir = std::env::temp_dir().join(format!(
            "pkt-study-seed-sync-{}-{unique}",
            std::process::id()
        ));
        fs::create_dir_all(&test_dir).expect("test directory should be created");

        let database_path = test_dir.join("pkt-study.db");
        let packaged_database_path = test_dir.join("packaged.db");
        fs::write(&database_path, b"old-database").expect("old database should be written");
        fs::write(test_dir.join("pkt-study.db-wal"), b"old-wal").expect("wal should be written");
        fs::write(test_dir.join("pkt-study.db-shm"), b"old-shm").expect("shm should be written");
        fs::write(&packaged_database_path, b"new-database").expect("seed should be written");

        replace_database_with_packaged_seed(&test_dir, &database_path, &packaged_database_path)
            .expect("seed sync should succeed");

        assert_eq!(fs::read(&database_path).unwrap(), b"new-database");
        assert_eq!(
            fs::read(test_dir.join("pkt-study.db.before-seed-sync")).unwrap(),
            b"old-database"
        );
        assert_eq!(
            fs::read(test_dir.join("pkt-study.db-wal.before-seed-sync")).unwrap(),
            b"old-wal"
        );
        assert_eq!(
            fs::read(test_dir.join("pkt-study.db-shm.before-seed-sync")).unwrap(),
            b"old-shm"
        );
        assert!(!test_dir.join("pkt-study.db-wal").exists());
        assert!(!test_dir.join("pkt-study.db-shm").exists());

        fs::remove_dir_all(test_dir).expect("test directory should be removed");
    }
}
