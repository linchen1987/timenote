use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;

use serde_json::{json, Value};
use tauri::{AppHandle, Manager};

use super::broker::{self, Broker};
use super::registry;

const MAX_HEADER_BYTES: usize = 16 * 1024;
const MAX_BODY_BYTES: usize = 10 * 1024 * 1024;
const MAX_CONNECTIONS: usize = 16;

pub struct ServerHandle {
    pub port: u16,
    pub shutdown: Arc<AtomicBool>,
}

/// Start the loopback JSON API. Binds 127.0.0.1 only; every route requires the
/// local Bearer token.
pub fn start(app: AppHandle, broker: Arc<Broker>, token: String) -> std::io::Result<ServerHandle> {
    let listener = TcpListener::bind("127.0.0.1:0")?;
    let port = listener.local_addr()?.port();
    let shutdown = Arc::new(AtomicBool::new(false));
    let shutdown_for_thread = shutdown.clone();
    let active = Arc::new(AtomicUsize::new(0));

    listener
        .set_nonblocking(true)
        .expect("tcp listener nonblocking");

    std::thread::Builder::new()
        .name("automation-http".into())
        .spawn(move || {
            loop {
                if shutdown_for_thread.load(Ordering::SeqCst) {
                    return;
                }
                match listener.accept() {
                    Ok((stream, _addr)) => {
                        if active.load(Ordering::SeqCst) >= MAX_CONNECTIONS {
                            continue;
                        }
                        active.fetch_add(1, Ordering::SeqCst);
                        let app = app.clone();
                        let broker = broker.clone();
                        let token = token.clone();
                        let active = active.clone();
                        let _ = std::thread::Builder::new()
                            .name("automation-conn".into())
                            .spawn(move || {
                                stream
                                    .set_read_timeout(Some(Duration::from_secs(75)))
                                    .ok();
                                stream
                                    .set_write_timeout(Some(Duration::from_secs(30)))
                                    .ok();
                                handle_connection(stream, &app, &broker, &token);
                                active.fetch_sub(1, Ordering::SeqCst);
                            });
                    }
                    Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                        std::thread::sleep(Duration::from_millis(100));
                    }
                    Err(_) => {
                        std::thread::sleep(Duration::from_millis(200));
                    }
                }
            }
        })?;

    Ok(ServerHandle { port, shutdown })
}

fn handle_connection(
    mut stream: TcpStream,
    app: &AppHandle,
    broker: &Broker,
    token: &str,
) {
    let (method, path, headers, body) = match read_request(&mut stream) {
        Ok(v) => v,
        Err(status) => {
            let body = json!({ "error": { "code": "INVALID_ARGUMENT", "message": "malformed http request" } });
            let _ = write_response(&mut stream, status, &body.to_string());
            return;
        }
    };

    let response = if !authorized(&headers, token) {
        json!({
            "protocolVersion": 1, "requestId": "", "ok": false,
            "error": { "code": "UNAUTHORIZED", "message": "missing or invalid bearer token", "retryable": false }
        })
    } else if !valid_host(&headers) {
        // DNS-rebinding protection: only loopback Host headers are accepted
        json!({
            "protocolVersion": 1, "requestId": "", "ok": false,
            "error": { "code": "UNAUTHORIZED", "message": "invalid host header", "retryable": false }
        })
    } else {
        route(app, broker, &method, &path, &body)
    };

    let _ = write_response(&mut stream, 200, &response.to_string());
}

type RequestHeaders = Vec<(String, String)>;

fn read_request(
    stream: &mut TcpStream,
) -> Result<(String, String, RequestHeaders, Value), u16> {
    let mut buffer: Vec<u8> = Vec::with_capacity(2048);
    let mut chunk = [0u8; 4096];
    // read headers
    loop {
        if buffer.len() > MAX_HEADER_BYTES {
            return Err(431u16);
        }
        let n = stream.read(&mut chunk).map_err(|_| 400u16)?;
        if n == 0 {
            return Err(400u16);
        }
        buffer.extend_from_slice(&chunk[..n]);
        if let Some(pos) = find_header_end(&buffer) {
            let header_str = String::from_utf8_lossy(&buffer[..pos]).to_string();
            let mut lines = header_str.split("\r\n");
            let request_line = lines.next().unwrap_or("");
            let mut parts = request_line.split_whitespace();
            let method = parts.next().unwrap_or("").to_uppercase();
            let path = parts.next().unwrap_or("").to_string();
            if method.is_empty() || path.is_empty() {
                return Err(400);
            }
            let mut headers = Vec::new();
            for line in lines {
                if let Some((name, value)) = line.split_once(':') {
                    headers.push((name.trim().to_lowercase(), value.trim().to_string()));
                }
            }

            let content_length: usize = headers
                .iter()
                .find(|(n, _)| n == "content-length")
                .and_then(|(_, v)| v.parse().ok())
                .unwrap_or(0);
            if content_length > MAX_BODY_BYTES {
                return Err(413u16);
            }

            let mut body_bytes = buffer[pos + 4..].to_vec();
            while body_bytes.len() < content_length {
                let n = stream.read(&mut chunk).map_err(|_| 400u16)?;
                if n == 0 {
                    break;
                }
                body_bytes.extend_from_slice(&chunk[..n]);
                if body_bytes.len() > MAX_BODY_BYTES {
                    return Err(413u16);
                }
            }
            body_bytes.truncate(content_length);
            let body = if body_bytes.is_empty() {
                Value::Null
            } else {
                serde_json::from_slice::<Value>(&body_bytes).unwrap_or(Value::Null)
            };
            return Ok((method, path, headers, body));
        }
    }
}

fn find_header_end(buffer: &[u8]) -> Option<usize> {
    buffer.windows(4).position(|w| w == b"\r\n\r\n")
}

fn authorized(headers: &RequestHeaders, token: &str) -> bool {
    let Some((_, value)) = headers.iter().find(|(n, _)| n == "authorization") else {
        return false;
    };
    let Some(provided) = value.strip_prefix("Bearer ") else {
        return false;
    };
    constant_time_eq(provided.as_bytes(), token.as_bytes())
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

fn valid_host(headers: &RequestHeaders) -> bool {
    match headers.iter().find(|(n, _)| n == "host") {
        Some((_, value)) => {
            let host = value.split(':').next().unwrap_or("");
            host == "127.0.0.1" || host == "localhost" || host == "[::1]"
        }
        None => false,
    }
}

fn write_response(stream: &mut TcpStream, status: u16, body: &str) -> std::io::Result<()> {
    let reason = match status {
        200 => "OK",
        400 => "Bad Request",
        401 => "Unauthorized",
        404 => "Not Found",
        413 => "Payload Too Large",
        431 => "Request Header Fields Too Large",
        _ => "Error",
    };
    let head = format!(
        "HTTP/1.1 {status} {reason}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        body.len()
    );
    stream.write_all(head.as_bytes())?;
    stream.write_all(body.as_bytes())?;
    stream.flush()
}

// ─── Routing ─────────────────────────────────────────────────────

fn route(app: &AppHandle, broker: &Broker, method: &str, path: &str, body: &Value) -> Value {
    match (method, path) {
        ("POST", "/api/v1/operations") => handle_operation(app, broker, body),
        ("GET", "/api/v1/status") => handle_status(app, broker),
        _ => {
            if let Some(op_id) = path.strip_prefix("/api/v1/operations/") {
                if method == "GET" && !op_id.is_empty() {
                    return broker.get_operation(op_id);
                }
            }
            broker::error_response("", "INVALID_ARGUMENT", "unknown route", false)
        }
    }
}

fn handle_operation(app: &AppHandle, broker: &Broker, body: &Value) -> Value {
    let request_id = body
        .get("requestId")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    if body.get("protocolVersion").and_then(Value::as_i64) != Some(1) {
        return broker::error_response(
            &request_id,
            "PROTOCOL_MISMATCH",
            "unsupported protocolVersion",
            false,
        );
    }

    let op = body
        .get("operation")
        .and_then(|o| o.get("op"))
        .and_then(Value::as_str)
        .unwrap_or("");

    match op {
        "desktop.status" => handle_status(app, broker),
        "notebooks.list" => handle_notebooks(app, broker, &request_id),
        "desktop.revealNote" => {
            let grants = super::read_grants();
            let project_id = body
                .get("operation")
                .and_then(|o| o.get("projectId"))
                .and_then(Value::as_str)
                .unwrap_or("");
            if !super::notebook_allowed(&grants, project_id) {
                return broker::error_response(
                    &request_id,
                    "FORBIDDEN",
                    "notebook is not authorized for agent access",
                    false,
                );
            }
            handle_reveal(app, broker, body, &request_id)
        }
        "notes.list" | "notes.search" | "notes.get" | "notes.create" | "notes.update"
        | "notes.delete" => {
            let project_id = body
                .get("operation")
                .and_then(|o| o.get("projectId"))
                .and_then(Value::as_str)
                .unwrap_or("");
            let grants = super::read_grants();
            if !super::notebook_allowed(&grants, project_id) {
                return broker::error_response(
                    &request_id,
                    "FORBIDDEN",
                    "notebook is not authorized for agent access",
                    false,
                );
            }
            if registry::read_vault_registry()
                .iter()
                .all(|v| v.project_id != project_id)
            {
                return broker::error_response(
                    &request_id,
                    "NOTEBOOK_NOT_FOUND",
                    "notebook is not registered on this machine",
                    false,
                );
            }

            // If the owning window is not open yet, open it (without stealing
            // focus) so its runtime can pick the request up.
            let known = broker.runtime_for_project(project_id).is_some();
            if !known {
                if let Some(entry) = registry::read_vault_registry()
                    .iter()
                    .find(|v| v.project_id == project_id)
                    .cloned()
                {
                    if let Err(e) = super::ensure_notebook_window_background(app, &entry.project_id, &entry.name) {
                        return broker::error_response(
                            &request_id,
                            "RUNTIME_NOT_READY",
                            &format!("failed to open notebook window: {e}"),
                            true,
                        );
                    }
                }
            }
            broker.submit(app, body.clone())
        }
        _ => broker::error_response(
            &request_id,
            "INVALID_ARGUMENT",
            &format!("unknown op: {op}"),
            false,
        ),
    }
}

fn handle_status(app: &AppHandle, broker: &Broker) -> Value {
    let runtimes: Vec<Value> = broker
        .runtime_infos()
        .into_iter()
        .map(|info| {
            json!({
                "runtimeId": if info.project_id.is_some() { Value::String(info.project_id.clone().unwrap()) } else { Value::String("list".into()) },
                "projectId": info.project_id,
                "open": true,
            })
        })
        .collect();
    let instance = {
        let state = app.state::<super::AutomationState>();
        let value = state.instance.lock().unwrap().clone();
        value
    };
    json!({
        "protocolVersion": 1,
        "requestId": "",
        "ok": true,
        "result": {
            "op": "desktop.status",
            "appVersion": app.package_info().version.to_string(),
            "protocolVersion": 1,
            "instanceId": instance,
            "runtimes": runtimes,
        }
    })
}

fn handle_notebooks(_app: &AppHandle, broker: &Broker, request_id: &str) -> Value {
    let grants = super::read_grants();
    let open_projects: Vec<String> = broker
        .runtime_infos()
        .into_iter()
        .filter_map(|r| r.project_id)
        .collect();
    // only notebooks inside the agent's authorized scope are listed
    let notebooks: Vec<Value> = registry::read_vault_registry()
        .into_iter()
        .filter(|v| super::notebook_allowed(&grants, &v.project_id))
        .map(|v| {
            json!({
                "projectId": v.project_id,
                "name": v.name,
                "open": open_projects.contains(&v.project_id),
            })
        })
        .collect();
    json!({
        "protocolVersion": 1,
        "requestId": request_id,
        "ok": true,
        "result": { "op": "notebooks.list", "notebooks": notebooks }
    })
}

fn handle_reveal(app: &AppHandle, broker: &Broker, body: &Value, request_id: &str) -> Value {
    let project_id = body
        .get("operation")
        .and_then(|o| o.get("projectId"))
        .and_then(Value::as_str)
        .unwrap_or("");
    let note_id = body
        .get("operation")
        .and_then(|o| o.get("noteId"))
        .and_then(Value::as_str)
        .unwrap_or("");
    if project_id.is_empty() || note_id.is_empty() {
        return broker::error_response(request_id, "INVALID_ARGUMENT", "projectId and noteId are required", false);
    }

    let entry = registry::read_vault_registry()
        .into_iter()
        .find(|v| v.project_id == project_id);
    let Some(entry) = entry else {
        return broker::error_response(request_id, "NOTEBOOK_NOT_FOUND", "notebook is not registered", false);
    };

    // reveal is the one operation allowed to focus the app
    match super::ensure_notebook_window_focused(app, &entry.project_id, &entry.name) {
        Ok(window_label) => {
            broker.push_reveal(project_id, note_id, app);
            json!({
                "protocolVersion": 1,
                "requestId": request_id,
                "ok": true,
                "result": { "op": "desktop.revealNote", "revealed": true, "window": window_label }
            })
        }
        Err(e) => broker::error_response(
            request_id,
            "RUNTIME_NOT_READY",
            &format!("failed to open notebook window: {e}"),
            true,
        ),
    }
}
