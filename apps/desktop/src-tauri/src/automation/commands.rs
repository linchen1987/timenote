use serde_json::Value;
use tauri::{AppHandle, Manager, State, Window};

use super::registry;
use super::AutomationState;

/// Register the calling WebView as the runtime for a notebook (or the shared
/// "list" runtime when project_id is None). Returns { runtimeId, generation }.
/// Registering a notebook also (re)starts its file watcher.
#[tauri::command]
pub fn automation_register_runtime(
    state: State<'_, AutomationState>,
    window: Window,
    project_id: Option<String>,
) -> Result<Value, String> {
    let app = window.app_handle();
    let result = state
        .broker
        .register_runtime(app, window.label(), project_id.clone());
    if let Some(project_id) = &project_id {
        if let Some(entry) = registry::read_vault_registry()
            .into_iter()
            .find(|v| &v.project_id == project_id)
        {
            state
                .watchers
                .ensure(app, project_id, &entry.path, window.label());
        }
    }
    Ok(result)
}

/// Claim pending automation work for the calling window's runtime.
/// Entries: { kind: "operation", requestId, request } | { kind: "reveal", noteId }.
#[tauri::command]
pub fn automation_claim_requests(
    state: State<'_, AutomationState>,
    window: Window,
) -> Result<Vec<Value>, String> {
    state.broker.claim(window.label())
}

/// Complete a previously claimed request. The completion is accepted only if
/// it comes from the same window and runtime generation that claimed it.
#[tauri::command]
pub fn automation_complete_request(
    state: State<'_, AutomationState>,
    window: Window,
    request_id: String,
    response: Value,
) -> Result<(), String> {
    state.broker.complete(window.label(), &request_id, response)
}

/// Persist a create operation's pre-allocated noteId (prepare journal) so a
/// crash between file write and completion cannot duplicate the note.
#[tauri::command]
pub fn automation_prepare_operation(
    state: State<'_, AutomationState>,
    operation_id: String,
    project_id: String,
    note_id: String,
    fingerprint: String,
) -> Result<(), String> {
    let fingerprint: u64 = fingerprint.parse().map_err(|_| "invalid fingerprint".to_string())?;
    state
        .broker
        .prepare_operation(operation_id, project_id, note_id, fingerprint)
}

#[tauri::command]
pub fn automation_status(app: AppHandle, state: State<'_, AutomationState>) -> Result<Value, String> {
    Ok(super::status_value(&app, &state))
}

#[tauri::command]
pub fn automation_set_enabled(
    app: AppHandle,
    state: State<'_, AutomationState>,
    enabled: bool,
) -> Result<Value, String> {
    super::set_enabled(&app, &state, enabled)?;
    Ok(super::status_value(&app, &state))
}

/// Restrict agent access to specific notebooks (projectId list); an empty
/// list means every registered notebook ("*"). Takes effect immediately for
/// new requests.
#[tauri::command]
pub fn automation_set_allowed_notebooks(
    app: AppHandle,
    state: State<'_, AutomationState>,
    allowed: Vec<String>,
) -> Result<Value, String> {
    super::set_allowed_notebooks(allowed)?;
    Ok(super::status_value(&app, &state))
}
