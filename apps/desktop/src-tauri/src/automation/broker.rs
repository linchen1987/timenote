use std::collections::HashMap;
use std::sync::{Arc, Condvar, Mutex};
use std::time::{Duration, Instant};

use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager};

use super::journal::{
    self, operation_fingerprint, CompletedEntry, PrepareRecord, COMPLETED_MAX_ENTRIES,
    COMPLETED_RETENTION,
};

pub const WAKE_EVENT: &str = "automation://wake";
pub const READ_TIMEOUT: Duration = Duration::from_secs(30);
pub const WRITE_TIMEOUT: Duration = Duration::from_secs(60);

// ─── Awaitable result shared between HTTP and WebView completion ───

pub struct Awaitable {
    state: Mutex<Option<Value>>,
    cvar: Condvar,
}

impl Awaitable {
    pub fn new() -> Arc<Awaitable> {
        Arc::new(Awaitable {
            state: Mutex::new(None),
            cvar: Condvar::new(),
        })
    }

    pub fn set(&self, value: Value) {
        let mut guard = self.state.lock().unwrap();
        if guard.is_none() {
            *guard = Some(value);
        }
        self.cvar.notify_all();
    }

    pub fn wait_timeout(&self, timeout: Duration) -> Option<Value> {
        let deadline = Instant::now() + timeout;
        let mut guard = self.state.lock().unwrap();
        loop {
            if let Some(ref v) = *guard {
                return Some(v.clone());
            }
            let now = Instant::now();
            if now >= deadline {
                return None;
            }
            let (new_guard, _) = self.cvar.wait_timeout(guard, deadline - now).unwrap();
            guard = new_guard;
        }
    }
}

// ─── Broker state ───────────────────────────────────────────────

#[derive(Clone)]
pub struct RuntimeInfo {
    pub window_label: String,
    pub generation: u64,
    pub project_id: Option<String>,
}

#[derive(Clone)]
pub struct PendingEntry {
    pub request_id: String,
    pub request: Value,
    pub runtime_id: String,
    pub operation_id: Option<String>,
    pub operation_json: String,
    pub is_write: bool,
    pub awaitable: Arc<Awaitable>,
}

pub struct ClaimedEntry {
    pub pending: PendingEntry,
    pub window_label: String,
    pub generation: u64,
}

pub struct BrokerInner {
    pub runtimes: HashMap<String, RuntimeInfo>,
    pub window_runtime: HashMap<String, String>,
    pub pending: HashMap<String, PendingEntry>,
    pub claimed: HashMap<String, ClaimedEntry>,
    pub completed: HashMap<String, CompletedEntry>,
    /// create operations that have persisted their pre-allocated noteId but
    /// not yet recorded a completed result (crash window)
    pub prepares: HashMap<String, PrepareRecord>,
    pub in_flight_ops: HashMap<String, String>,
    pub pending_reveals: Vec<(String, String)>,
}

pub struct Broker {
    pub inner: Mutex<BrokerInner>,
}

impl Broker {
    pub fn new() -> Broker {
        let (completed, prepares) = journal::load();
        let mut inner = BrokerInner {
            runtimes: HashMap::new(),
            window_runtime: HashMap::new(),
            pending: HashMap::new(),
            claimed: HashMap::new(),
            completed: HashMap::new(),
            prepares: HashMap::new(),
            in_flight_ops: HashMap::new(),
            pending_reveals: Vec::new(),
        };
        inner.completed.extend(completed);
        inner.prepares.extend(prepares);
        Broker {
            inner: Mutex::new(inner),
        }
    }

    // ─── Runtime lifecycle ───────────────────────────────────────

    pub fn register_runtime(
        &self,
        app: &AppHandle,
        window_label: &str,
        project_id: Option<String>,
    ) -> Value {
        let runtime_id = project_id.clone().unwrap_or_else(|| "list".to_string());
        let mut inner = self.inner.lock().unwrap();

        // A window (re)registering replaces any previous registration from
        // the same window; a fresh generation invalidates stale answers.
        let generation = inner
            .runtimes
            .get(&runtime_id)
            .map(|info| info.generation + 1)
            .unwrap_or(1);

        // Drop claims belonging to older generations of this runtime.
        let stale_claims: Vec<String> = inner
            .claimed
            .iter()
            .filter(|(_, c)| c.pending.runtime_id == runtime_id)
            .map(|(id, _)| id.clone())
            .collect();
        for id in stale_claims {
            if let Some(claim) = inner.claimed.remove(&id) {
                if let Some(op_id) = claim.pending.operation_id.clone() {
                    inner.in_flight_ops.remove(&op_id);
                }
                claim.pending.awaitable.set(error_response(
                    &claim.pending.request_id,
                    "RUNTIME_NOT_READY",
                    "runtime re-registered while request was executing",
                    true,
                ));
            }
        }

        inner.runtimes.insert(
            runtime_id.clone(),
            RuntimeInfo {
                window_label: window_label.to_string(),
                generation,
                project_id: project_id.clone(),
            },
        );
        inner
            .window_runtime
            .insert(window_label.to_string(), runtime_id.clone());

        let has_pending = inner
            .pending
            .values()
            .any(|p| p.runtime_id == runtime_id)
            || inner.pending_reveals.iter().any(|(rid, _)| rid == &runtime_id);
        drop(inner);

        if has_pending {
            emit_wake(app, window_label);
        }

        json!({ "runtimeId": runtime_id, "generation": generation })
    }

    pub fn remove_window(&self, window_label: &str) {
        let mut inner = self.inner.lock().unwrap();
        let Some(runtime_id) = inner.window_runtime.remove(window_label) else {
            return;
        };
        let is_owner = inner
            .runtimes
            .get(&runtime_id)
            .map(|info| info.window_label == window_label)
            .unwrap_or(false);
        if !is_owner {
            return;
        }
        inner.runtimes.remove(&runtime_id);

        // Requests claimed by the dying window cannot complete; writes may be
        // partially applied so clients get OUTCOME_UNKNOWN and must re-check.
        let doomed: Vec<String> = inner
            .claimed
            .iter()
            .filter(|(_, c)| c.window_label == window_label)
            .map(|(id, _)| id.clone())
            .collect();
        for id in doomed {
            if let Some(claim) = inner.claimed.remove(&id) {
                if let Some(op_id) = claim.pending.operation_id.clone() {
                    inner.in_flight_ops.remove(&op_id);
                }
                let code = if claim.pending.is_write {
                    "OUTCOME_UNKNOWN"
                } else {
                    "RUNTIME_NOT_READY"
                };
                claim.pending.awaitable.set(error_response(
                    &claim.pending.request_id,
                    code,
                    "notebook window closed while request was executing",
                    false,
                ));
            }
        }
    }

    pub fn runtime_for_project(&self, project_id: &str) -> Option<RuntimeInfo> {
        let inner = self.inner.lock().unwrap();
        inner.runtimes.get(project_id).cloned()
    }

    pub fn runtime_infos(&self) -> Vec<RuntimeInfo> {
        let inner = self.inner.lock().unwrap();
        inner.runtimes.values().cloned().collect()
    }

    // ─── Request submission (HTTP side) ──────────────────────────

    /// Submit a validated request envelope. Returns the final response JSON
    /// (waited for within the request deadline) or an error envelope on
    /// immediate routing failures.
    pub fn submit(&self, app: &AppHandle, request: Value) -> Value {
        let request_id = request
            .get("requestId")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        let op = request
            .get("operation")
            .and_then(|o| o.get("op"))
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        let project_id = request
            .get("operation")
            .and_then(|o| o.get("projectId"))
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        let operation_id = request
            .get("operation")
            .and_then(|o| o.get("operationId"))
            .and_then(Value::as_str)
            .map(str::to_string);
        let operation_json = request
            .get("operation")
            .map(|o| o.to_string())
            .unwrap_or_default();
        let is_write = matches!(op.as_str(), "notes.create" | "notes.update" | "notes.delete");

        if op.is_empty() || request_id.is_empty() {
            return error_response(&request_id, "INVALID_ARGUMENT", "missing op or requestId", false);
        }

        let runtime_id = match op.as_str() {
            "notes.list" | "notes.search" | "notes.get" | "notes.create" | "notes.update"
          | "notes.delete" => {
                if project_id.is_empty() {
                    return error_response(&request_id, "INVALID_ARGUMENT", "projectId is required", false);
                }
                project_id
            }
            _ => {
                return error_response(
                    &request_id,
                    "INVALID_ARGUMENT",
                    &format!("operation {op} is not handled by the runtime"),
                    false,
                );
            }
        };

        let timeout = if is_write { WRITE_TIMEOUT } else { READ_TIMEOUT };

        let mut inner = self.inner.lock().unwrap();

        // Idempotency for writes: same operationId + same parameters returns
        // the stored result; same operationId with different parameters is
        // rejected; an in-flight duplicate waits for the original. The check
        // uses a fingerprint so records restored from the journal (which do
        // not carry the full operation JSON) compare consistently.
        if is_write {
            if let Some(op_id) = &operation_id {
                let fingerprint = operation_fingerprint(&operation_json);
                if let Some(done) = inner.completed.get(op_id) {
                    if done.fingerprint == fingerprint {
                        let mut response = done.response.clone();
                        if let Some(obj) = response.as_object_mut() {
                            obj.insert("requestId".into(), Value::String(request_id.clone()));
                        }
                        return response;
                    }
                    return error_response(
                        &request_id,
                        "OPERATION_ID_REUSED",
                        "operationId already used with different parameters",
                        false,
                    );
                }
                if let Some(original_request_id) = inner.in_flight_ops.get(op_id).cloned() {
                    let awaitable = inner
                        .pending
                        .get(&original_request_id)
                        .map(|p| p.awaitable.clone())
                        .or_else(|| {
                            inner
                                .claimed
                                .get(&original_request_id)
                                .map(|c| c.pending.awaitable.clone())
                        });
                    if let Some(awaitable) = awaitable {
                        drop(inner);
                        if let Some(response) = awaitable.wait_timeout(timeout) {
                            return response;
                        }
                        return error_response(
                            &request_id,
                            "OUTCOME_UNKNOWN",
                            "duplicate operation still executing; query operations.get later",
                            false,
                        );
                    }
                }
            }
        }

        // Create operations carry prepare-journal enrichment: a retry after a
        // crash gets its pre-allocated noteId so the runtime replays
        // idempotently instead of duplicating the note.
        let mut forwarded_request = request.clone();
        if op == "notes.create" {
            let fingerprint_value = operation_fingerprint(&operation_json);
            let mut allocated: Option<String> = None;
            if let Some(op_id) = &operation_id {
                if let Some(prep) = inner.prepares.get(op_id) {
                    if prep.fingerprint != fingerprint_value {
                        return error_response(
                            &request_id,
                            "OPERATION_ID_REUSED",
                            "operationId already used with different parameters",
                            false,
                        );
                    }
                    allocated = Some(prep.note_id.clone());
                }
            }
            if let Some(op_obj) = forwarded_request
                .get_mut("operation")
                .and_then(Value::as_object_mut)
            {
                op_obj.insert("fingerprint".into(), json!(fingerprint_value.to_string()));
                if let Some(note_id) = allocated {
                    op_obj.insert("allocatedNoteId".into(), json!(note_id));
                }
            }
        }

        let entry = PendingEntry {
            request_id: request_id.clone(),
            request: forwarded_request,
            runtime_id: runtime_id.clone(),
            operation_id: operation_id.clone(),
            operation_json: operation_json.clone(),
            is_write,
            awaitable: Awaitable::new(),
        };
        let awaitable = entry.awaitable.clone();
        if let Some(op_id) = &operation_id {
            inner.in_flight_ops.insert(op_id.clone(), request_id.clone());
        }
        inner.pending.insert(request_id.clone(), entry);
        drop(inner);

        emit_wake(app, &window_label_for_runtime(app, &runtime_id));

        match awaitable.wait_timeout(timeout) {
            Some(response) => response,
            None => {
                // Timed out: the WebView may still be processing. Writes must
                // not be retried blindly — the result stays queryable. Unclaimed
                // reads are dropped so they cannot leak; claimed writes stay
                // registered so a late completion still records the result.
                let mut inner = self.inner.lock().unwrap();
                if let Some(entry) = inner.pending.remove(&request_id) {
                    if let Some(op_id) = &entry.operation_id {
                        inner.in_flight_ops.remove(op_id);
                    }
                }
                drop(inner);
                let code = if is_write { "OUTCOME_UNKNOWN" } else { "RUNTIME_NOT_READY" };
                error_response(
                    &request_id,
                    code,
                    if is_write {
                        "request timed out; the write may have completed — query operations.get before retrying"
                    } else {
                        "notebook runtime did not answer in time"
                    },
                    !is_write,
                )
            }
        }
    }

    // ─── WebView side: claim & complete ──────────────────────────

    /// Claims pending work for the runtime owned by the calling window.
    /// Returns JSON entries: { kind: "operation", requestId, request } or
    /// { kind: "reveal", noteId }.
    pub fn claim(&self, window_label: &str) -> Result<Vec<Value>, String> {
        let mut inner = self.inner.lock().unwrap();
        let runtime_id = inner
            .window_runtime
            .get(window_label)
            .cloned()
            .ok_or_else(|| "window has no registered runtime".to_string())?;
        let generation = inner
            .runtimes
            .get(&runtime_id)
            .map(|info| info.generation)
            .ok_or_else(|| "runtime no longer registered".to_string())?;

        let mut out = Vec::new();

        let reveals: Vec<String> = inner
            .pending_reveals
            .iter()
            .filter(|(rid, _)| rid == &runtime_id)
            .map(|(_, note_id)| note_id.clone())
            .collect();
        inner.pending_reveals.retain(|(rid, _)| rid != &runtime_id);
        for note_id in reveals {
            out.push(json!({ "kind": "reveal", "noteId": note_id }));
        }

        let ready_ids: Vec<String> = inner
            .pending
            .values()
            .filter(|p| p.runtime_id == runtime_id)
            .map(|p| p.request_id.clone())
            .collect();
        for id in ready_ids {
            if let Some(entry) = inner.pending.remove(&id) {
                inner.claimed.insert(
                    id.clone(),
                    ClaimedEntry {
                        pending: entry.clone(),
                        window_label: window_label.to_string(),
                        generation,
                    },
                );
                out.push(json!({
                    "kind": "operation",
                    "requestId": entry.request_id,
                    "request": entry.request,
                }));
            }
        }

        Ok(out)
    }

    /// Persist a create's pre-allocated noteId before the file write so a
    /// crash between write and completion cannot duplicate the note on retry.
    pub fn prepare_operation(
        &self,
        operation_id: String,
        project_id: String,
        note_id: String,
        fingerprint: u64,
    ) -> Result<(), String> {
        let mut inner = self.inner.lock().unwrap();
        // the first prepare wins; retries reuse the same allocation
        if inner.prepares.contains_key(&operation_id) {
            return Ok(());
        }
        let record = PrepareRecord {
            operation_id: operation_id.clone(),
            project_id,
            note_id,
            fingerprint,
            created_epoch: journal::epoch_secs(),
        };
        journal::append_prepare_journal(&record);
        inner.prepares.insert(operation_id, record);
        Ok(())
    }

    pub fn complete(
        &self,
        window_label: &str,
        request_id: &str,
        response: Value,
    ) -> Result<(), String> {
        let mut inner = self.inner.lock().unwrap();
        let (claim_window, claim_gen, claim_runtime, op_id, op_json, awaitable) = {
            let claim = inner
                .claimed
                .get(request_id)
                .ok_or_else(|| "unknown request".to_string())?;
            (
                claim.window_label.clone(),
                claim.generation,
                claim.pending.runtime_id.clone(),
                claim.pending.operation_id.clone(),
                claim.pending.operation_json.clone(),
                claim.pending.awaitable.clone(),
            )
        };
        if claim_window != window_label {
            return Err("request is not claimed by this window".to_string());
        }
        let current_gen = inner.runtimes.get(&claim_runtime).map(|info| info.generation);
        if current_gen != Some(claim_gen) {
            return Err("runtime generation expired".to_string());
        }

        inner.claimed.remove(request_id);
        if let Some(op_id) = &op_id {
            inner.in_flight_ops.remove(op_id);
            let is_ok = response.get("ok").and_then(Value::as_bool).unwrap_or(false);
            if is_ok {
                if inner.completed.len() >= COMPLETED_MAX_ENTRIES {
                    prune_completed(&mut inner);
                }
                let entry = CompletedEntry {
                    response: response.clone(),
                    fingerprint: operation_fingerprint(&op_json),
                    completed_at: Instant::now(),
                    completed_epoch: journal::epoch_secs(),
                };
                journal::append_journal(
                    op_id,
                    entry.fingerprint,
                    &entry.response,
                    entry.completed_epoch,
                );
                inner.completed.insert(op_id.clone(), entry);
                inner.prepares.remove(op_id);
            }
        }
        drop(inner);
        awaitable.set(response);
        Ok(())
    }

    pub fn push_reveal(&self, runtime_id: &str, note_id: &str, app: &AppHandle) {
        let window_label = {
            let mut inner = self.inner.lock().unwrap();
            let label = inner
                .runtimes
                .get(runtime_id)
                .map(|info| info.window_label.clone());
            match label {
                Some(l) => l,
                None => {
                    inner
                        .pending_reveals
                        .push((runtime_id.to_string(), note_id.to_string()));
                    return;
                }
            }
        };
        let delivered = emit_reveal(app, &window_label, note_id);
        if !delivered {
            let mut inner = self.inner.lock().unwrap();
            inner
                .pending_reveals
                .push((runtime_id.to_string(), note_id.to_string()));
        }
    }

    pub fn get_operation(&self, operation_id: &str) -> Value {
        let inner = self.inner.lock().unwrap();
        if let Some(done) = inner.completed.get(operation_id) {
            return done.response.clone();
        }
        if let Some(request_id) = inner.in_flight_ops.get(operation_id) {
            let executing = inner.claimed.contains_key(request_id);
            return error_response_with_details(
                request_id,
                "OUTCOME_UNKNOWN",
                if executing {
                    "operation is still executing"
                } else {
                    "operation is queued"
                },
                false,
                json!({ "inProgress": true }),
            );
        }
        error_response("", "NOTE_NOT_FOUND", "unknown operationId", false)
    }
}

fn prune_completed(inner: &mut BrokerInner) {
    let now = Instant::now();
    inner
        .completed
        .retain(|_, entry| now.duration_since(entry.completed_at) < COMPLETED_RETENTION);
    while inner.completed.len() >= COMPLETED_MAX_ENTRIES {
        let oldest = inner
            .completed
            .iter()
            .min_by_key(|(_, e)| e.completed_at)
            .map(|(k, _)| k.clone());
        match oldest {
            Some(k) => {
                inner.completed.remove(&k);
            }
            None => break,
        }
    }
    let prepares = inner.prepares.clone();
    journal::rewrite_journal(&inner.completed, &prepares);
}

// Operation journal persistence lives in journal.rs.


pub fn error_response(request_id: &str, code: &str, message: &str, retryable: bool) -> Value {
    error_response_with_details(request_id, code, message, retryable, Value::Null)
}

pub fn error_response_with_details(
    request_id: &str,
    code: &str,
    message: &str,
    retryable: bool,
    details: Value,
) -> Value {
    let mut error = json!({
        "code": code,
        "message": message,
        "retryable": retryable,
    });
    if !details.is_null() {
        error["details"] = details;
    }
    json!({
        "protocolVersion": 1,
        "requestId": request_id,
        "ok": false,
        "error": error,
    })
}

fn window_label_for_runtime(app: &AppHandle, runtime_id: &str) -> String {
    if runtime_id == "list" {
        return "list".to_string();
    }
    // Prefer an existing notebook window owning this project.
    if let Some(window) = app
        .webview_windows()
        .values()
        .find(|w| w.label().starts_with("nb-"))
    {
        let label = window.label().to_string();
        if project_id_of_label(&label) == Some(runtime_id.to_string()) {
            return label;
        }
    }
    format!("nb-{runtime_id}")
}

fn project_id_of_label(label: &str) -> Option<String> {
    let token = label.strip_prefix("nb-")?;
    Some(token.split('_').next().unwrap_or(token).to_string())
}

fn emit_wake(app: &AppHandle, window_label: &str) {
    // targeted emit: other notebook windows must not pump for this runtime
    let _ = app.emit_to(
        tauri::EventTarget::labeled(window_label),
        WAKE_EVENT,
        (),
    );
}

fn emit_reveal(app: &AppHandle, window_label: &str, note_id: &str) -> bool {
    app.emit_to(
        tauri::EventTarget::labeled(window_label),
        "automation://reveal",
        json!({ "noteId": note_id }),
    )
    .is_ok()
}

#[cfg(test)]
mod tests {
    use super::project_id_of_label;

    // Notebook window labels come in two shapes: automation-created
    // `nb-<projectId>` and UI-created `nb-<projectId>_<nameToken>` — both
    // must resolve to the bare projectId (which may itself contain
    // underscores).
    #[test]
    fn label_parsing_extracts_project_id() {
        assert_eq!(project_id_of_label("nb-abc"), Some("abc".to_string()));
        assert_eq!(project_id_of_label("nb-abc_2Bkc"), Some("abc".to_string()));
        assert_eq!(project_id_of_label("nb-a_b_c"), Some("a".to_string()));
        assert_eq!(project_id_of_label("list"), None);
        assert_eq!(project_id_of_label(""), None);
    }
}
