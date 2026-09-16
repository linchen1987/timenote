use std::collections::HashMap;
use std::path::Path;
use std::sync::mpsc::{channel, Receiver};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use notify::event::{DataChange, EventKind, ModifyKind};
use notify::{Event, RecommendedWatcher, RecursiveMode, Watcher as NotifyWatcher};
use serde_json::json;
use tauri::{AppHandle, Emitter};

use super::broker;
use super::registry;

const FS_CHANGED_EVENT: &str = "automation://fs-changed";
/// Quiet period before a burst of fs events is forwarded to the runtime.
/// The runtime always reads final file state, so coalescing is safe.
const DEBOUNCE: Duration = Duration::from_millis(250);

struct WatcherHandle {
    /// Dropping the notify watcher stops delivery; kept alive here.
    _watcher: RecommendedWatcher,
    window_label: String,
}

#[derive(Default)]
pub struct WatcherManager {
    watchers: Mutex<HashMap<String, WatcherHandle>>,
}

/// Note id per the core spec: `[0-9]{8}-[0-9]{6}-[0-9]{4}` (20 ASCII
/// chars), note files are `<note-id>.md`. Hand-rolled to avoid a regex
/// dependency — the tests below pin the shape so this cannot drift from
/// the TypeScript spec.
const NOTE_ID_LEN: usize = 20;

fn is_note_file(path: &Path) -> bool {
    let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
        return false;
    };
    let Some(stem) = name.strip_suffix(".md") else {
        return false;
    };
    if stem.len() != NOTE_ID_LEN {
        return false;
    }
    let bytes = stem.as_bytes();
    if bytes[8] != b'-' || bytes[15] != b'-' {
        return false;
    }
    bytes[..8]
        .iter()
        .chain(bytes[9..15].iter())
        .chain(bytes[16..NOTE_ID_LEN].iter())
        .all(|b| b.is_ascii_digit())
}

fn note_id_of(path: &Path) -> Option<String> {
    if !is_note_file(path) {
        return None;
    }
    path.file_name()?
        .to_str()?
        .strip_suffix(".md")
        .map(str::to_string)
}

fn is_content_change(kind: &EventKind) -> bool {
    matches!(
        kind,
        EventKind::Create(_) | EventKind::Remove(_) | EventKind::Modify(ModifyKind::Data(DataChange::Any)) | EventKind::Modify(ModifyKind::Name(_)) | EventKind::Any
    )
}

impl WatcherManager {
    /// Start (or keep) the recursive watcher for one notebook vault. Events are
    /// debounced, filtered to note files and forwarded to the owning window;
    /// the runtime reconciles by reading final file state.
    pub fn ensure(&self, app: &AppHandle, project_id: &str, vault_path: &str, window_label: &str) {
        let mut watchers = self.watchers.lock().unwrap();
        if watchers.contains_key(project_id) {
            return;
        }

        let (tx, rx) = channel::<notify::Result<Event>>();
        let watcher: RecommendedWatcher = match NotifyWatcher::new(
            move |res: notify::Result<Event>| {
                let _ = tx.send(res);
            },
            notify::Config::default(),
        ) {
            Ok(w) => w,
            Err(e) => {
                eprintln!("[automation] failed to create watcher for {project_id}: {e}");
                return;
            }
        };
        let mut watcher = watcher;

        if let Err(e) = watcher.watch(Path::new(vault_path), RecursiveMode::Recursive) {
            eprintln!("[automation] cannot watch {vault_path}: {e}");
            return;
        }

        let app = app.clone();
        let window_label_for_thread = window_label.to_string();
        let project_id_owned = project_id.to_string();
        std::thread::Builder::new()
            .name(format!("fs-watch-{project_id}"))
            .spawn(move || {
                debounce_loop(&rx, &app, &project_id_owned, &window_label_for_thread);
            })
            .ok();

        watchers.insert(
            project_id.to_string(),
            WatcherHandle {
                _watcher: watcher,
                window_label: window_label.to_string(),
            },
        );
    }

    /// Stop the watcher when its notebook window (runtime) is gone.
    pub fn stop_for_window(&self, window_label: &str) {
        let mut watchers = self.watchers.lock().unwrap();
        let dead_keys: Vec<String> = watchers
            .iter()
            .filter(|(_, h)| h.window_label == window_label)
            .map(|(k, _)| k.clone())
            .collect();
        for key in dead_keys {
            watchers.remove(&key);
        }
    }
}

fn debounce_loop(rx: &Receiver<notify::Result<Event>>, app: &AppHandle, project_id: &str, window_label: &str) {
    let mut pending: Vec<String> = Vec::new();
    loop {
        // Block until the first event of a burst; a channel close (watcher
        // dropped) ends the thread.
        match rx.recv() {
            Ok(event) => collect_event(event, &mut pending),
            Err(_) => return,
        }
        // Drain the burst, then wait out the quiet period.
        while let Ok(event) = rx.recv_timeout(DEBOUNCE) {
            collect_event(event, &mut pending);
        }
        if pending.is_empty() {
            continue;
        }
        pending.sort();
        pending.dedup();
        let note_ids = std::mem::take(&mut pending);
        let _ = app.emit_to(
            tauri::EventTarget::labeled(window_label),
            FS_CHANGED_EVENT,
            json!({ "projectId": project_id, "noteIds": note_ids }),
        );
    }
}

fn collect_event(event: notify::Result<Event>, pending: &mut Vec<String>) {
    let Ok(event) = event else {
        return;
    };
    if !is_content_change(&event.kind) {
        return;
    }
    for path in &event.paths {
        if let Some(note_id) = note_id_of(path) {
            pending.push(note_id);
        }
    }
}

/// Ensure watchers exist for every currently-registered runtime (used after
/// the automation server starts or runtimes re-register).
pub fn sync_watchers(manager: &Arc<WatcherManager>, app: &AppHandle, broker: &broker::Broker) {
    for entry in registry::read_vault_registry() {
        if let Some(info) = broker.runtime_for_project(&entry.project_id) {
            manager.ensure(app, &entry.project_id, &entry.path, &info.window_label);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::is_note_file;
    use std::path::Path;

    // fixtures mirror the canonical note id shape so the Rust filter and the
    // core spec cannot drift apart silently
    #[test]
    fn accepts_canonical_note_filenames() {
        assert!(is_note_file(Path::new("20260916-083000-1234.md")));
        assert!(is_note_file(Path::new("/vault/2024/20240102-030405-6789.md")));
    }

    #[test]
    fn rejects_non_note_files() {
        assert!(!is_note_file(Path::new("manifest.json")));
        assert!(!is_note_file(Path::new("20260916-083000-1234.txt")));
        // trailing group must be exactly 4 digits (the old size check bug)
        assert!(!is_note_file(Path::new("20260916-083000-1.md")));
        assert!(!is_note_file(Path::new("20260916-083000-12345.md")));
        // every digit group must be numeric
        assert!(!is_note_file(Path::new("2026091x-083000-1234.md")));
        assert!(!is_note_file(Path::new("20260916-08x000-1234.md")));
        assert!(!is_note_file(Path::new("20260916-083000-12x4.md")));
    }
}
