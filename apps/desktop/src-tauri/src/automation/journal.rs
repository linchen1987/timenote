use std::collections::HashMap;
use std::io::Write;
use std::time::{Duration, Instant};

use serde_json::{json, Value};

use crate::fs_commands::config_dir;

// Crash-safe idempotency journal for automation write operations. Only
// fingerprints of operation parameters are persisted — note content must
// never be duplicated outside the vault.

pub const COMPLETED_RETENTION: Duration = Duration::from_secs(7 * 24 * 3600);
pub const COMPLETED_MAX_ENTRIES: usize = 512;

#[derive(Clone)]
pub struct PrepareRecord {
    pub operation_id: String,
    pub project_id: String,
    pub note_id: String,
    pub fingerprint: u64,
    pub created_epoch: u64,
}

pub struct CompletedEntry {
    pub response: Value,
    pub fingerprint: u64,
    pub completed_at: Instant,
    pub completed_epoch: u64,
}

pub fn epoch_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// FNV-1a 64 + length mix: detects accidental parameter mismatches for
/// OPERATION_ID_REUSED; not an adversarial hash (local, honest clients).
pub fn operation_fingerprint(operation_json: &str) -> u64 {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for byte in operation_json.as_bytes() {
        hash ^= *byte as u64;
        hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
    }
    hash ^ ((operation_json.len() as u64) << 32)
}

fn journal_path() -> std::path::PathBuf {
    std::path::Path::new(&config_dir())
        .join("automation")
        .join("operations.jsonl")
}

fn journal_line(
    operation_id: &str,
    fingerprint: u64,
    response: &Value,
    completed_epoch: u64,
) -> String {
    json!({
        "kind": "completed",
        "operationId": operation_id,
        "fingerprint": fingerprint,
        "response": response,
        "completedAt": completed_epoch,
    })
    .to_string()
}

fn prepare_journal_line(record: &PrepareRecord) -> String {
    json!({
        "kind": "prepare",
        "operationId": record.operation_id,
        "projectId": record.project_id,
        "noteId": record.note_id,
        "fingerprint": record.fingerprint,
        "createdAt": record.created_epoch,
    })
    .to_string()
}

pub fn append_prepare_journal(record: &PrepareRecord) {
    let path = journal_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let Ok(mut file) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
    else {
        eprintln!("[automation] cannot open operation journal");
        return;
    };
    if let Err(e) = writeln!(file, "{}", prepare_journal_line(record)) {
        eprintln!("[automation] journal append failed: {e}");
    }
}

pub fn append_journal(
    operation_id: &str,
    fingerprint: u64,
    response: &Value,
    completed_epoch: u64,
) {
    let path = journal_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let Ok(mut file) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
    else {
        eprintln!("[automation] cannot open operation journal");
        return;
    };
    if let Err(e) = writeln!(file, "{}", journal_line(operation_id, fingerprint, response, completed_epoch)) {
        eprintln!("[automation] journal append failed: {e}");
    }
}

pub fn rewrite_journal(
    completed: &HashMap<String, CompletedEntry>,
    prepares: &HashMap<String, PrepareRecord>,
) {
    let path = journal_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let tmp = path.with_extension("jsonl.tmp");
    let mut body = String::new();
    for (op_id, entry) in completed {
        body.push_str(&journal_line(
            op_id,
            entry.fingerprint,
            &entry.response,
            entry.completed_epoch,
        ));
        body.push('\n');
    }
    for record in prepares.values() {
        body.push_str(&prepare_journal_line(record));
        body.push('\n');
    }
    if std::fs::write(&tmp, body).and_then(|_| std::fs::rename(&tmp, &path)).is_err() {
        eprintln!("[automation] journal rewrite failed");
    }
}

/// Load persisted journal state (completed results first, unresolved prepares
/// second), applying retention rules. A completed record wins over a prepare
/// with the same operationId.
pub fn load() -> (
    HashMap<String, CompletedEntry>,
    HashMap<String, PrepareRecord>,
) {
    let mut restored: HashMap<String, CompletedEntry> = HashMap::new();
    let mut restored_prepares: HashMap<String, PrepareRecord> = HashMap::new();
    let Ok(raw) = std::fs::read_to_string(journal_path()) else {
        return (restored, restored_prepares);
    };
    let now_epoch = epoch_secs();
    for line in raw.lines() {
        let Ok(value) = serde_json::from_str::<Value>(line) else {
            continue;
        };
        // lines without "kind" are legacy completed records
        let kind = value.get("kind").and_then(Value::as_str).unwrap_or("completed");
        let Some(op_id) = value.get("operationId").and_then(Value::as_str) else {
            continue;
        };
        let Some(fingerprint) = value.get("fingerprint").and_then(Value::as_u64) else {
            continue;
        };
        if kind == "prepare" {
            let created_epoch = value
                .get("createdAt")
                .and_then(Value::as_u64)
                .unwrap_or(now_epoch);
            if now_epoch.saturating_sub(created_epoch) > COMPLETED_RETENTION.as_secs() {
                continue;
            }
            let Some(project_id) = value.get("projectId").and_then(Value::as_str) else {
                continue;
            };
            let Some(note_id) = value.get("noteId").and_then(Value::as_str) else {
                continue;
            };
            restored_prepares.insert(
                op_id.to_string(),
                PrepareRecord {
                    operation_id: op_id.to_string(),
                    project_id: project_id.to_string(),
                    note_id: note_id.to_string(),
                    fingerprint,
                    created_epoch,
                },
            );
            continue;
        }
        let completed_epoch = value
            .get("completedAt")
            .and_then(Value::as_u64)
            .unwrap_or(now_epoch);
        // expired entries are dropped instead of restored
        if now_epoch.saturating_sub(completed_epoch) > COMPLETED_RETENTION.as_secs() {
            continue;
        }
        let Some(response) = value.get("response").cloned() else {
            continue;
        };
        restored.insert(
            op_id.to_string(),
            CompletedEntry {
                response,
                fingerprint,
                completed_at: Instant::now(),
                completed_epoch,
            },
        );
    }
    // completed wins over prepare for the same operationId
    for op_id in restored.keys() {
        restored_prepares.remove(op_id);
    }
    if restored.len() > COMPLETED_MAX_ENTRIES {
        rewrite_journal(&restored, &restored_prepares);
    }
    (restored, restored_prepares)
}

#[cfg(test)]
mod tests {
    use super::operation_fingerprint;

    #[test]
    fn fingerprint_is_stable_and_sensitive() {
        let a = r#"{"op":"notes.update","content":"v1"}"#;
        assert_eq!(operation_fingerprint(a), operation_fingerprint(a));
        assert_ne!(operation_fingerprint(a), operation_fingerprint(r#"{"op":"notes.update","content":"v2"}"#));
        // equal content, different lengths must differ
        assert_ne!(
            operation_fingerprint(r#"{"a":"x"}"#),
            operation_fingerprint(r#"{"a":"x ","b":""}"#)
        );
    }
}
