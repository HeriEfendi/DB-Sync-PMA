use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IncrementalWatermark {
    pub last_synced_id: serde_json::Value,
    pub last_sync_time: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PmaExportConfig {
    pub url: String,
    pub username: String,
    pub password: String,
    pub database: String,
    pub tables: Vec<String>,
    pub sync_mode: Option<String>,
    pub row_limit: Option<usize>,
    pub throttle_ms: Option<u64>,
    pub table_primary_keys: Option<HashMap<String, String>>,
    pub primary_key: Option<String>,
    pub incremental_watermarks: Option<HashMap<String, IncrementalWatermark>>,
    pub tables_with_updated_at: Option<HashSet<String>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LogPayload {
    pub r#type: String,
    pub message: String,
    pub timestamp: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProgressPayload {
    pub current_table_index: usize,
    pub total_tables: usize,
    pub current_table_name: String,
    pub rows_synced_current_table: usize,
    pub total_synced_all_tables: usize,
    pub status: String,
}
