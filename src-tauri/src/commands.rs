use std::collections::HashMap;

pub use crate::models::{CleanupWatermark, LocalDbConfig, TableLastIdInfo};
pub use crate::repository::{get_local_table_columns, table_exists};
pub use crate::utils::{build_connection_string, sanitize_identifier};

/// Test connection to local MySQL / MariaDB server (TCP & Docker)
#[tauri::command]
pub async fn test_local_connection(config: LocalDbConfig) -> Result<String, String> {
    let server_ver = crate::repository::test_mysql_tcp_connection(&config).await?;

    if config.use_docker {
        let container = config.docker_container.trim();
        if container.is_empty() {
            return Err("Opsi Docker diaktifkan, namun 'Nama / ID Kontainer Docker' masih kosong.".to_string());
        }

        let extract_output = |out: &std::process::Output| -> String {
            let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
            let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !stderr.is_empty() {
                stderr
            } else if !stdout.is_empty() {
                stdout
            } else {
                format!("Kode status keluar: {:?}", out.status.code().unwrap_or(-1))
            }
        };

        let docker_check_mysql = crate::process_utils::new_std_command("docker")
            .arg("exec")
            .arg(container)
            .arg("mysql")
            .arg("--version")
            .output();

        match docker_check_mysql {
            Ok(out) if out.status.success() => {
                let docker_ver = {
                    let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
                    if s.is_empty() {
                        String::from_utf8_lossy(&out.stderr).trim().to_string()
                    } else {
                        s
                    }
                };
                return Ok(format!(
                    "Koneksi TCP berhasil (Server: {}) | Docker [{}] (MySQL CLI): {}",
                    server_ver, container, docker_ver
                ));
            }
            Ok(out_mysql) => {
                let docker_check_mariadb = crate::process_utils::new_std_command("docker")
                    .arg("exec")
                    .arg(container)
                    .arg("mariadb")
                    .arg("--version")
                    .output();

                match docker_check_mariadb {
                    Ok(out_maria) if out_maria.status.success() => {
                        let docker_ver = {
                            let s = String::from_utf8_lossy(&out_maria.stdout).trim().to_string();
                            if s.is_empty() {
                                String::from_utf8_lossy(&out_maria.stderr).trim().to_string()
                            } else {
                                s
                            }
                        };
                        return Ok(format!(
                            "Koneksi TCP berhasil (Server: {}) | Docker [{}] (MariaDB CLI): {}",
                            server_ver, container, docker_ver
                        ));
                    }
                    Ok(out_maria) => {
                        let err_mysql = extract_output(&out_mysql);
                        let err_maria = extract_output(&out_maria);
                        return Err(format!(
                            "Koneksi TCP MySQL berhasil ({}), tetapi 'docker exec' ke kontainer '{}' gagal.\n• mysql: {}\n• mariadb: {}",
                            server_ver, container, err_mysql, err_maria
                        ));
                    }
                    Err(e) => {
                        let err_mysql = extract_output(&out_mysql);
                        return Err(format!(
                            "Koneksi TCP MySQL berhasil ({}), tetapi 'docker exec' ke kontainer '{}' gagal: {}\n(Error sistem: {})",
                            server_ver, container, err_mysql, e
                        ));
                    }
                }
            }
            Err(e) => {
                return Err(format!(
                    "Koneksi TCP MySQL berhasil ({}), tetapi gagal menjalankan perintah 'docker' pada host: {}. Pastikan Docker terinstall dan ada di PATH sistem.",
                    server_ver, e
                ));
            }
        }
    }

    Ok(format!("Koneksi berhasil! Versi Server: {}", server_ver))
}

#[tauri::command]
pub async fn get_last_local_id(
    config: LocalDbConfig,
    table_name: String,
    primary_key: String,
) -> Result<Option<serde_json::Value>, String> {
    crate::repository::query_last_local_id(&config, &table_name, &primary_key).await
}

#[tauri::command]
pub async fn get_all_tables_last_local_ids(
    config: LocalDbConfig,
    tables: Vec<String>,
) -> Result<HashMap<String, TableLastIdInfo>, String> {
    crate::repository::query_all_tables_last_local_ids(&config, &tables).await
}

#[tauri::command]
pub async fn delete_local_rows_after_id(
    config: LocalDbConfig,
    table_name: String,
    primary_key: String,
    last_synced_id: serde_json::Value,
) -> Result<u64, String> {
    crate::repository::delete_rows_after_id(&config, &table_name, &primary_key, last_synced_id).await
}

#[tauri::command]
pub async fn batch_cleanup_incremental(
    app: tauri::AppHandle,
    config: LocalDbConfig,
    watermarks: HashMap<String, CleanupWatermark>,
    batch_size: Option<u64>,
    concurrency: Option<usize>,
) -> Result<HashMap<String, u64>, String> {
    crate::repository::execute_batch_cleanup(app, &config, watermarks, batch_size, concurrency).await
}

#[tauri::command]
pub async fn get_local_tables(config: LocalDbConfig) -> Result<Vec<String>, String> {
    crate::repository::query_local_tables(&config).await
}

#[tauri::command]
pub async fn drop_local_tables(config: LocalDbConfig, tables: Vec<String>) -> Result<Vec<String>, String> {
    crate::repository::execute_drop_tables(&config, tables).await
}
