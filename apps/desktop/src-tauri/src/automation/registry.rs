use serde_json::Value;

use crate::fs_commands::config_dir;

/// Notebook registry (config.json): the mapping from projectId to a local
/// vault directory, used to route agent requests and open notebook windows.

#[derive(Clone)]
pub struct VaultRegistryEntry {
    pub project_id: String,
    pub name: String,
    pub path: String,
}

pub fn read_vault_registry() -> Vec<VaultRegistryEntry> {
    let path = std::path::Path::new(&config_dir()).join("config.json");
    let Ok(raw) = std::fs::read_to_string(path) else {
        return Vec::new();
    };
    let Ok(value) = serde_json::from_str::<Value>(&raw) else {
        return Vec::new();
    };
    value
        .get("vaults")
        .and_then(Value::as_array)
        .map(|arr| {
            arr.iter()
                .filter_map(|v| {
                    let project_id = v.get("projectId")?.as_str()?.to_string();
                    let name = v.get("name")?.as_str()?.to_string();
                    let path = v.get("path")?.as_str()?.to_string();
                    Some(VaultRegistryEntry {
                        project_id,
                        name,
                        path,
                    })
                })
                .collect()
        })
        .unwrap_or_default()
}
