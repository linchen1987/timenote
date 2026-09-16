pub mod broker;
pub mod commands;
pub mod http_server;
pub mod journal;
pub mod registry;
pub mod watcher;

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde_json::json;
use tauri::{AppHandle, Manager, State};

use crate::fs_commands::config_dir;

pub struct AutomationState {
    pub broker: Arc<broker::Broker>,
    pub server: Mutex<Option<http_server::ServerHandle>>,
    pub watchers: Arc<watcher::WatcherManager>,
    instance: Mutex<String>,
    enabled: AtomicBool,
}

impl AutomationState {
    pub fn new() -> AutomationState {
        AutomationState {
            broker: Arc::new(broker::Broker::new()),
            server: Mutex::new(None),
            watchers: Arc::new(watcher::WatcherManager::default()),
            instance: Mutex::new(generate_token(16)),
            enabled: AtomicBool::new(false),
        }
    }
}


fn automation_dir() -> PathBuf {
    PathBuf::from(config_dir()).join("automation")
}

fn descriptor_path() -> PathBuf {
    automation_dir().join("descriptor.json")
}

fn credentials_path() -> PathBuf {
    automation_dir().join("credentials.json")
}

fn grants_path() -> PathBuf {
    automation_dir().join("grants.json")
}

fn generate_token(bytes: usize) -> String {
    let mut seed = Vec::new();
    if let Ok(mut f) = std::fs::File::open("/dev/urandom") {
        use std::io::Read;
        let mut buf = vec![0u8; bytes];
        if f.read_exact(&mut buf).is_ok() {
            seed = buf;
        }
    }
    if seed.is_empty() {
        // fallback entropy: time + pid, hashed through a simple xorshift
        let mut x = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos() as u64)
            .unwrap_or(0x9e3779b97f4a7c15)
            ^ ((std::process::id() as u64) << 32);
        for _ in 0..bytes {
            x ^= x << 13;
            x ^= x >> 7;
            x ^= x << 17;
            seed.push((x & 0xff) as u8);
        }
    }
    seed.iter().map(|b| format!("{b:02x}")).collect()
}

#[derive(Clone, Debug)]
pub struct Grants {
    pub enabled: bool,
    /// Authorized notebook projectIds; ["*"] means every registered notebook.
    pub allowed_notebooks: Vec<String>,
}

impl Default for Grants {
    fn default() -> Self {
        Grants {
            enabled: false,
            allowed_notebooks: vec!["*".to_string()],
        }
    }
}

pub fn read_grants() -> Grants {
    let Ok(raw) = std::fs::read_to_string(grants_path()) else {
        return Grants::default();
    };
    let value = serde_json::from_str::<serde_json::Value>(&raw).unwrap_or_default();
    Grants {
        enabled: value
            .get("enabled")
            .and_then(|e| e.as_bool())
            .unwrap_or(false),
        allowed_notebooks: value
            .get("allowedNotebooks")
            .and_then(|a| a.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(str::to_string))
                    .collect()
            })
            .filter(|v: &Vec<String>| !v.is_empty())
            .unwrap_or_else(|| vec!["*".to_string()]),
    }
}

pub fn notebook_allowed(grants: &Grants, project_id: &str) -> bool {
    grants
        .allowed_notebooks
        .iter()
        .any(|n| n == "*" || n == project_id)
}

fn write_grants(grants: &Grants) -> Result<(), String> {
    let dir = automation_dir();
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let tmp = dir.join("grants.json.tmp");
    std::fs::write(
        &tmp,
        json!({ "enabled": grants.enabled, "allowedNotebooks": grants.allowed_notebooks }).to_string(),
    )
    .map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, grants_path()).map_err(|e| e.to_string())
}

/// Local connection token. Created on first enable, persisted with 0600 perms
/// so the CLI (same user) can read it.
fn load_or_create_token() -> Result<String, String> {
    if let Ok(raw) = std::fs::read_to_string(credentials_path()) {
        if let Some(token) = serde_json::from_str::<serde_json::Value>(&raw)
            .ok()
            .and_then(|v| v.get("token").and_then(|t| t.as_str()).map(str::to_string))
        {
            if token.len() >= 32 {
                return Ok(token);
            }
        }
    }
    let token = generate_token(32);
    let dir = automation_dir();
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    std::fs::write(credentials_path(), json!({ "token": token }).to_string())
        .map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(credentials_path(), std::fs::Permissions::from_mode(0o600));
    }
    Ok(token)
}

pub fn status_value(app: &AppHandle, state: &AutomationState) -> serde_json::Value {
    let server = state.server.lock().unwrap();
    let running = server.is_some();
    let endpoint = server
        .as_ref()
        .map(|s| format!("http://127.0.0.1:{}", s.port));
    let runtimes = state.broker.runtime_infos().len();
    let grants = read_grants();
    json!({
        "enabled": state.enabled.load(Ordering::SeqCst),
        "running": running,
        "endpoint": endpoint,
        "protocolVersion": 1,
        "appVersion": app.package_info().version.to_string(),
        "runtimes": runtimes,
        "allowedNotebooks": grants.allowed_notebooks,
        "descriptorPath": descriptor_path().to_string_lossy(),
        "credentialsPath": credentials_path().to_string_lossy(),
    })
}

/// Start the loopback server if grants allow it. Safe to call repeatedly.
pub fn ensure_server(app: &AppHandle, state: &AutomationState) -> Result<(), String> {
    let grants = read_grants();
    state.enabled.store(grants.enabled, Ordering::SeqCst);
    if !grants.enabled {
        stop_server(state);
        return Ok(());
    }
    start_server(app, state)
}

fn start_server(app: &AppHandle, state: &AutomationState) -> Result<(), String> {
    {
        let server = state.server.lock().unwrap();
        if server.is_some() {
            return Ok(());
        }
    }
    let token = load_or_create_token()?;
    let handle = http_server::start(app.clone(), state.broker.clone(), token)
        .map_err(|e| format!("failed to bind loopback server: {e}"))?;
    let endpoint = format!("http://127.0.0.1:{}", handle.port);

    let dir = automation_dir();
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let descriptor = json!({
        "endpoint": endpoint,
        "instanceId": *state.instance.lock().unwrap(),
        "protocolVersion": 1,
        "startedAt": chrono_now_iso(),
    });
    let tmp = dir.join("descriptor.json.tmp");
    std::fs::write(&tmp, descriptor.to_string()).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, descriptor_path()).map_err(|e| e.to_string())?;
    *state.server.lock().unwrap() = Some(handle);
    // watchers may outlive a stopped server; make sure open runtimes are covered
    watcher::sync_watchers(&state.watchers, app, &state.broker);
    Ok(())
}

fn stop_server(state: &AutomationState) {
    let mut server = state.server.lock().unwrap();
    if let Some(handle) = server.take() {
        handle.shutdown.store(true, Ordering::SeqCst);
    }
    let _ = std::fs::remove_file(descriptor_path());
}

pub fn set_enabled(app: &AppHandle, state: &AutomationState, enabled: bool) -> Result<(), String> {
    let mut grants = read_grants();
    grants.enabled = enabled;
    write_grants(&grants)?;
    state.enabled.store(enabled, Ordering::SeqCst);
    if enabled {
        start_server(app, state)
    } else {
        stop_server(state);
        Ok(())
    }
}

pub fn set_allowed_notebooks(allowed: Vec<String>) -> Result<(), String> {
    let mut grants = read_grants();
    grants.allowed_notebooks = if allowed.is_empty() {
        vec!["*".to_string()]
    } else {
        allowed
    };
    write_grants(&grants)
}

fn chrono_now_iso() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = now.as_secs();
    let millis = now.subsec_millis();
    // convert to UTC without a chrono dependency
    let days = secs / 86400;
    let rem = secs % 86400;
    let (h, m, s) = (rem / 3600, (rem % 3600) / 60, rem % 60);
    // civil-from-days (Howard Hinnant's algorithm)
    let z = days as i64 + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = if month <= 2 { y + 1 } else { y };
    format!("{year:04}-{month:02}-{d:02}T{h:02}:{m:02}:{s:02}.{millis:03}Z")
}

// ─── Notebook window helpers (main-thread safe) ───────────────────

fn find_owner_window(app: &AppHandle, project_id: &str) -> Option<String> {
    // Automation-created windows use the raw projectId as label suffix and
    // must match exactly (projectIds may contain underscores); windows opened
    // via the UI use `${projectId}_${base58(name)}` tokens, matched by prefix.
    let exact = format!("nb-{project_id}");
    if app.get_webview_window(&exact).is_some() {
        return Some(exact);
    }
    for label in app.webview_windows().keys() {
        if let Some(token) = label.strip_prefix("nb-") {
            let pid = token.split('_').next().unwrap_or(token);
            if pid == project_id {
                return Some(label.clone());
            }
        }
    }
    None
}

fn ensure_notebook_window(
    app: &AppHandle,
    project_id: &str,
    name: &str,
    focus: bool,
) -> Result<String, String> {
    if let Some(label) = find_owner_window(app, project_id) {
        if focus {
            let label_for_main = label.clone();
            let handle_for_main = app.clone();
            app.run_on_main_thread(move || {
                if let Some(window) = handle_for_main.get_webview_window(&label_for_main) {
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            })
            .map_err(|e| e.to_string())?;
        }
        return Ok(label);
    }

    let label = format!("nb-{project_id}");
    let (tx, rx) = std::sync::mpsc::channel::<Result<String, String>>();
    let handle = app.clone();
    let label_for_main = label.clone();
    let title = name.to_string();
    app.run_on_main_thread(move || {
        let result = crate::window_commands::build_notebook_window_for_automation(
            &handle,
            &label_for_main,
            &title,
            focus,
        );
        let _ = tx.send(result);
    })
    .map_err(|e| e.to_string())?;
    rx.recv_timeout(Duration::from_secs(15))
        .map_err(|e| format!("window creation timed out: {e}"))?
}

pub fn ensure_notebook_window_background(
    app: &AppHandle,
    project_id: &str,
    name: &str,
) -> Result<String, String> {
    ensure_notebook_window(app, project_id, name, false)
}

pub fn ensure_notebook_window_focused(
    app: &AppHandle,
    project_id: &str,
    name: &str,
) -> Result<String, String> {
    ensure_notebook_window(app, project_id, name, true)
}

pub fn handle_window_destroyed(app: &AppHandle, label: &str) {
    let state: State<AutomationState> = app.state();
    state.watchers.stop_for_window(label);
    state.broker.remove_window(label);
}
