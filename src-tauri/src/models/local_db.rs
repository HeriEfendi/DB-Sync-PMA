use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LocalDbConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub database: String,
    #[serde(default)]
    pub use_docker: bool,
    #[serde(default)]
    pub docker_container: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TableLastIdInfo {
    pub table: String,
    pub primary_key: String,
    pub last_id: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CleanupWatermark {
    pub primary_key: String,
    pub last_synced_id: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CleanupLogPayload {
    pub r#type: String,
    pub message: String,
    pub timestamp: String,
}

