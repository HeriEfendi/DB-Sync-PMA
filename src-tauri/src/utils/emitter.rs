use crate::models::{CleanupLogPayload, LogPayload, ProgressPayload};
use tauri::Emitter;

pub fn current_timestamp() -> String {
    chrono::Local::now().format("%H:%M:%S").to_string()
}

pub fn emit_log(app: &tauri::AppHandle, log_type: &str, message: impl Into<String>) {
    let msg = message.into();
    let norm_type = if log_type == "warn" { "warning" } else { log_type };

    let noisy_http = norm_type == "info"
        && [
            "Inisialisasi HTTP Session",
            "PMA final URL setelah redirect",
            "HTML index.php",
            "Redirect HTML ditemukan",
            "Resolved redirect URL",
            "effective_base_url diperbarui",
            "Re-fetch dari",
            "CSRF token diekstrak",
            "Token baru dari login response",
            "POST request ke export",
            "Endpoint PMA valid ditemukan",
            "Export menerima",
        ]
        .iter()
        .any(|prefix| msg.starts_with(prefix) || msg.contains(prefix));

    let noisy_fallback =
        norm_type == "warning" && (msg.contains("tidak menghasilkan PK"));

    if noisy_http || noisy_fallback {
        println!("[PMA-LOG] [{}]: {}", norm_type, msg);
        return;
    }

    println!("[PMA-LOG] [{}]: {}", norm_type, msg);
    let _ = app.emit(
        "pma-log",
        LogPayload {
            r#type: norm_type.to_string(),
            message: msg,
            timestamp: current_timestamp(),
        },
    );
}

pub fn emit_cleanup_log(app: &tauri::AppHandle, log_type: &str, message: impl Into<String>) {
    let msg = message.into();
    println!("[CLEANUP] [{}]: {}", log_type, msg);
    let _ = app.emit(
        "pma-log",
        CleanupLogPayload {
            r#type: log_type.to_string(),
            message: msg,
            timestamp: current_timestamp(),
        },
    );
}

pub fn emit_progress(
    app: &tauri::AppHandle,
    current_index: usize,
    total: usize,
    table_name: &str,
    current_rows: usize,
    total_rows: usize,
    status: &str,
) {
    let _ = app.emit(
        "pma-progress",
        ProgressPayload {
            current_table_index: current_index,
            total_tables: total,
            current_table_name: table_name.to_string(),
            rows_synced_current_table: current_rows,
            total_synced_all_tables: total_rows,
            status: status.to_string(),
        },
    );
}
