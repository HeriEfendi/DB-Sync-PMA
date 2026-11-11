use crate::models::{CleanupWatermark, LocalDbConfig};
use crate::utils::{
    build_connection_string, emit_cleanup_log, format_number_u64, sanitize_identifier,
};
use sqlx::{
    mysql::{MySqlPoolOptions},
    Row,
};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Semaphore;
use super::local_db_queries::{get_local_table_columns, table_exists};

pub async fn delete_rows_after_id(
    config: &LocalDbConfig,
    table_name: &str,
    primary_key: &str,
    last_synced_id: serde_json::Value,
) -> Result<u64, String> {
    let is_valid_id = match &last_synced_id {
        serde_json::Value::Number(num) => {
            num.as_i64().map(|n| n > 0).unwrap_or(false)
                || num.as_f64().map(|f| f > 0.0).unwrap_or(false)
        }
        serde_json::Value::String(s) => {
            let trimmed = s.trim();
            !trimmed.is_empty() && trimmed != "0"
        }
        _ => false,
    };

    if !is_valid_id {
        return Ok(0);
    }

    let conn_str = build_connection_string(config);
    let pool = MySqlPoolOptions::new()
        .max_connections(2)
        .connect(&conn_str)
        .await
        .map_err(|e| format!("Koneksi ke MySQL lokal gagal: {}", e))?;

    if !table_exists(&pool, table_name).await.unwrap_or(false) {
        pool.close().await;
        return Ok(0);
    }

    let cols = get_local_table_columns(&pool, table_name).await.unwrap_or_default();
    let pk_exists = cols.iter().any(|c| c.eq_ignore_ascii_case(primary_key));
    if !pk_exists {
        pool.close().await;
        return Ok(0);
    }

    let safe_table = sanitize_identifier(table_name)?;
    let safe_pk = sanitize_identifier(primary_key)?;

    let mut conn = pool.acquire().await.map_err(|e| format!("Koneksi ke MySQL lokal gagal: {}", e))?;
    let _ = sqlx::query("SET FOREIGN_KEY_CHECKS=0").execute(&mut *conn).await;

    let query = format!("DELETE FROM {} WHERE {} > ?", safe_table, safe_pk);
    let result = match last_synced_id {
        serde_json::Value::Number(num) => {
            if let Some(n) = num.as_i64() {
                sqlx::query(&query).bind(n).execute(&mut *conn).await
            } else if let Some(n) = num.as_u64() {
                sqlx::query(&query).bind(n as i64).execute(&mut *conn).await
            } else if let Some(f) = num.as_f64() {
                sqlx::query(&query).bind(f).execute(&mut *conn).await
            } else {
                sqlx::query(&query).bind(num.to_string()).execute(&mut *conn).await
            }
        }
        serde_json::Value::String(value) => sqlx::query(&query).bind(value).execute(&mut *conn).await,
        _ => {
            let _ = sqlx::query("SET FOREIGN_KEY_CHECKS=1").execute(&mut *conn).await;
            drop(conn);
            pool.close().await;
            return Err("Last synced ID harus angka atau teks".to_string());
        }
    };

    let _ = sqlx::query("SET FOREIGN_KEY_CHECKS=1").execute(&mut *conn).await;
    let result = result.map_err(|e| format!("Gagal menghapus data lokal setelah {}: {}", primary_key, e))?;

    drop(conn);
    pool.close().await;
    Ok(result.rows_affected())
}

pub async fn execute_batch_cleanup(
    app: tauri::AppHandle,
    config: &LocalDbConfig,
    watermarks: HashMap<String, CleanupWatermark>,
    batch_size: Option<u64>,
    concurrency: Option<usize>,
) -> Result<HashMap<String, u64>, String> {
    let effective_batch = batch_size.unwrap_or(50_000).max(1_000);
    let effective_concurrency = concurrency.unwrap_or(3).max(1).min(8);

    if watermarks.is_empty() {
        return Ok(HashMap::new());
    }

    let conn_str = build_connection_string(config);
    let pool = Arc::new(
        MySqlPoolOptions::new()
            .max_connections((effective_concurrency as u32 + 2).min(10))
            .connect(&conn_str)
            .await
            .map_err(|e| format!("Koneksi ke MySQL lokal gagal: {}", e))?,
    );

    emit_cleanup_log(
        &app,
        "info",
        format!(
            "🧹 Memulai batch cleanup {} tabel (batch={}, paralel={})",
            watermarks.len(),
            effective_batch,
            effective_concurrency
        ),
    );

    let semaphore = Arc::new(Semaphore::new(effective_concurrency));
    let app_arc = Arc::new(app);
    let mut handles = Vec::new();

    for (table_name, wm) in watermarks.into_iter() {
        let is_valid = match &wm.last_synced_id {
            serde_json::Value::Number(num) => {
                num.as_i64().map(|n| n > 0).unwrap_or(false)
                    || num.as_f64().map(|f| f > 0.0).unwrap_or(false)
            }
            serde_json::Value::String(s) => {
                let trimmed = s.trim();
                !trimmed.is_empty() && trimmed != "0"
            }
            _ => false,
        };
        if !is_valid {
            continue;
        }

        let pool = Arc::clone(&pool);
        let sem = Arc::clone(&semaphore);
        let app_handle = Arc::clone(&app_arc);
        let pk = wm.primary_key.clone();
        let last_id = wm.last_synced_id.clone();
        let batch_sz = effective_batch;

        let handle = tokio::spawn(async move {
            let _permit = sem.acquire().await.map_err(|e| format!("Semaphore error: {}", e))?;

            if !table_exists(&pool, &table_name).await.unwrap_or(false) {
                return Ok::<(String, u64), String>((table_name, 0));
            }
            let cols = get_local_table_columns(&pool, &table_name).await.unwrap_or_default();
            if !cols.iter().any(|c| c.eq_ignore_ascii_case(&pk)) {
                return Ok((table_name, 0));
            }

            let safe_table = sanitize_identifier(&table_name)?;
            let safe_pk = sanitize_identifier(&pk)?;
            let mut conn = pool.acquire().await.map_err(|e| format!("Pool acquire gagal untuk '{}': {}", table_name, e))?;

            let _ = sqlx::query("SET FOREIGN_KEY_CHECKS=0").execute(&mut *conn).await;
            let count_query = format!("SELECT COUNT(*) FROM {} WHERE {} > ?", safe_table, safe_pk);
            let total_to_delete: u64 = match &last_id {
                serde_json::Value::Number(num) => {
                    let n = num.as_i64().unwrap_or(0);
                    sqlx::query(&count_query).bind(n).fetch_one(&mut *conn).await.and_then(|r| r.try_get::<i64, _>(0).map(|v| v as u64)).unwrap_or(0)
                }
                serde_json::Value::String(s) => {
                    sqlx::query(&count_query).bind(s.clone()).fetch_one(&mut *conn).await.and_then(|r| r.try_get::<i64, _>(0).map(|v| v as u64)).unwrap_or(0)
                }
                _ => 0,
            };

            if total_to_delete == 0 {
                let _ = sqlx::query("SET FOREIGN_KEY_CHECKS=1").execute(&mut *conn).await;
                return Ok((table_name, 0));
            }

            let total_batches = ((total_to_delete as f64) / (batch_sz as f64)).ceil() as u64;
            emit_cleanup_log(
                &app_handle,
                "info",
                format!("🗑️ [Cleanup '{}'] {} row akan dihapus dalam ~{} batch", table_name, format_number_u64(total_to_delete), total_batches),
            );

            let delete_query = format!("DELETE FROM {} WHERE {} > ? ORDER BY {} ASC LIMIT {}", safe_table, safe_pk, safe_pk, batch_sz);
            let mut total_deleted: u64 = 0;
            let mut batch_idx: u64 = 0;

            loop {
                if crate::utils::cancellation::is_user_cancelled() {
                    break;
                }
                let affected = match &last_id {
                    serde_json::Value::Number(num) => {
                        let n = num.as_i64().unwrap_or(0);
                        sqlx::query(&delete_query).bind(n).execute(&mut *conn).await.map(|r| r.rows_affected()).unwrap_or(0)
                    }
                    serde_json::Value::String(s) => {
                        sqlx::query(&delete_query).bind(s.clone()).execute(&mut *conn).await.map(|r| r.rows_affected()).unwrap_or(0)
                    }
                    _ => 0,
                };

                if affected == 0 {
                    break;
                }
                total_deleted += affected;
                batch_idx += 1;

                let pct = if total_to_delete > 0 {
                    ((total_deleted as f64 / total_to_delete as f64) * 100.0).min(100.0)
                } else {
                    100.0
                };

                emit_cleanup_log(
                    &app_handle,
                    "info",
                    format!("🗑️ [Cleanup '{}'] Batch {}/{}: {} / {} row dihapus ({:.0}%)", table_name, batch_idx, total_batches, format_number_u64(total_deleted), format_number_u64(total_to_delete), pct),
                );
                tokio::time::sleep(std::time::Duration::from_millis(5)).await;
            }

            let _ = sqlx::query("SET FOREIGN_KEY_CHECKS=1").execute(&mut *conn).await;
            if total_deleted > 0 {
                emit_cleanup_log(
                    &app_handle,
                    "warning",
                    format!("✅ [Cleanup '{}'] Selesai: {} row dihapus untuk sinkron dengan server", table_name, format_number_u64(total_deleted)),
                );
            }

            Ok((table_name, total_deleted))
        });
        handles.push(handle);
    }

    let mut result_map = HashMap::new();
    for handle in handles {
        match handle.await {
            Ok(Ok((table, count))) => {
                result_map.insert(table, count);
            }
            Ok(Err(e)) => {
                emit_cleanup_log(&app_arc, "error", format!("Cleanup error: {}", e));
            }
            Err(e) => {
                emit_cleanup_log(&app_arc, "error", format!("Cleanup task panic: {}", e));
            }
        }
    }

    let total_all: u64 = result_map.values().sum();
    emit_cleanup_log(
        &app_arc,
        "success",
        format!("🧹 Batch cleanup selesai: {} row dihapus dari {} tabel", format_number_u64(total_all), result_map.len()),
    );

    pool.close().await;
    Ok(result_map)
}

