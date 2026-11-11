use crate::models::{LocalDbConfig, TableLastIdInfo};
use crate::utils::{build_connection_string, sanitize_identifier};
use sqlx::{
    mysql::{MySqlPool, MySqlPoolOptions},
    Row,
};
use std::collections::HashMap;

pub async fn table_exists(pool: &MySqlPool, table_name: &str) -> Result<bool, String> {
    let escaped_name = table_name.replace('\'', "''");
    let query = format!(
        "SELECT COUNT(*) AS cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '{}'",
        escaped_name
    );

    let row = sqlx::query(&query)
        .fetch_optional(pool)
        .await
        .map_err(|e| format!("Gagal mengecek keberadaan tabel lokal '{}': {}", table_name, e))?;

    let count = row.and_then(|r| r.try_get::<i64, _>(0).ok()).unwrap_or(0);
    Ok(count > 0)
}

pub async fn get_local_table_columns(pool: &MySqlPool, table_name: &str) -> Result<Vec<String>, String> {
    let escaped_name = table_name.replace('\'', "''");
    let query = format!(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '{}' ORDER BY ORDINAL_POSITION ASC",
        escaped_name
    );

    let rows = sqlx::query(&query).fetch_all(pool).await.map_err(|e| {
        format!("Gagal membaca struktur kolom tabel lokal '{}': {}", table_name, e)
    })?;

    let mut columns = Vec::new();
    for row in rows {
        if let Ok(col_name) = row.try_get::<String, _>(0) {
            columns.push(col_name);
        }
    }
    Ok(columns)
}

pub async fn test_mysql_tcp_connection(config: &LocalDbConfig) -> Result<String, String> {
    let conn_str = build_connection_string(config);
    let pool = MySqlPoolOptions::new()
        .max_connections(2)
        .connect(&conn_str)
        .await
        .map_err(|e| format!("Gagal terhubung ke MySQL lokal: {}", e))?;

    let row: (String,) = sqlx::query_as("SELECT VERSION()")
        .fetch_one(&pool)
        .await
        .map_err(|e| format!("Gagal mengambil versi MySQL: {}", e))?;

    pool.close().await;
    Ok(row.0)
}

pub async fn query_last_local_id(
    config: &LocalDbConfig,
    table_name: &str,
    primary_key: &str,
) -> Result<Option<serde_json::Value>, String> {
    let conn_str = build_connection_string(config);
    let pool = MySqlPoolOptions::new()
        .max_connections(2)
        .connect(&conn_str)
        .await
        .map_err(|e| format!("Koneksi ke MySQL lokal gagal: {}", e))?;

    if !table_exists(&pool, table_name).await.unwrap_or(false) {
        pool.close().await;
        return Ok(None);
    }

    let cols = get_local_table_columns(&pool, table_name).await.unwrap_or_default();
    if cols.is_empty() {
        pool.close().await;
        return Ok(None);
    }

    let effective_pk = if cols.iter().any(|c| c.eq_ignore_ascii_case(primary_key)) {
        primary_key.to_string()
    } else if let Some(found_pk) = cols.iter().find(|c| c.eq_ignore_ascii_case("id") || c.to_ascii_lowercase().ends_with("_id") || c.to_ascii_lowercase().starts_with("id_")).cloned() {
        found_pk
    } else if let Some(first_col) = cols.first().cloned() {
        first_col
    } else {
        pool.close().await;
        return Ok(None);
    };

    let safe_table = sanitize_identifier(table_name)?;
    let safe_pk = sanitize_identifier(&effective_pk)?;
    let query = format!("SELECT MAX({}) AS max_id FROM {}", safe_pk, safe_table);

    let row = sqlx::query(&query)
        .fetch_optional(&pool)
        .await
        .map_err(|e| format!("Gagal query MAX({}): {}", effective_pk, e))?;

    pool.close().await;

    if let Some(r) = row {
        if let Ok(val) = r.try_get::<u64, _>(0) {
            return Ok(Some(serde_json::Value::Number(val.into())));
        }
        if let Ok(val) = r.try_get::<i64, _>(0) {
            return Ok(Some(serde_json::Value::Number(val.into())));
        }
        if let Ok(val) = r.try_get::<f64, _>(0) {
            if let Some(num) = serde_json::Number::from_f64(val) {
                return Ok(Some(serde_json::Value::Number(num)));
            }
        }
        if let Ok(val) = r.try_get::<String, _>(0) {
            return Ok(Some(serde_json::Value::String(val)));
        }
    }
    Ok(None)
}

pub async fn query_all_tables_last_local_ids(
    config: &LocalDbConfig,
    tables: &[String],
) -> Result<HashMap<String, TableLastIdInfo>, String> {
    let conn_str = build_connection_string(config);
    let pool = MySqlPoolOptions::new()
        .max_connections(2)
        .connect(&conn_str)
        .await
        .map_err(|e| format!("Koneksi ke MySQL lokal gagal: {}", e))?;

    let pk_query = "SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_KEY = 'PRI' ORDER BY ORDINAL_POSITION ASC";
    let pk_rows = sqlx::query(pk_query).fetch_all(&pool).await.unwrap_or_default();
    let mut table_pk_map: HashMap<String, String> = HashMap::new();
    for r in pk_rows {
        if let (Ok(tbl), Ok(col)) = (r.try_get::<String, _>(0), r.try_get::<String, _>(1)) {
            table_pk_map.entry(tbl).or_insert(col);
        }
    }

    let mut result = HashMap::new();
    for table_name in tables {
        if !table_exists(&pool, table_name).await.unwrap_or(false) {
            continue;
        }

        let effective_pk = if let Some(pk) = table_pk_map.get(table_name) {
            pk.clone()
        } else {
            let cols = get_local_table_columns(&pool, table_name).await.unwrap_or_default();
            if cols.is_empty() {
                continue;
            }
            if let Some(found_pk) = cols.iter().find(|c| c.eq_ignore_ascii_case("id") || c.to_ascii_lowercase().ends_with("_id") || c.to_ascii_lowercase().starts_with("id_")).cloned() {
                found_pk
            } else if let Some(first_col) = cols.first().cloned() {
                first_col
            } else {
                continue;
            }
        };

        let safe_table = match sanitize_identifier(table_name) {
            Ok(s) => s,
            Err(_) => continue,
        };
        let safe_pk = match sanitize_identifier(&effective_pk) {
            Ok(s) => s,
            Err(_) => continue,
        };

        let query = format!("SELECT MAX({}) AS max_id FROM {}", safe_pk, safe_table);
        let row_opt = sqlx::query(&query).fetch_optional(&pool).await.ok().flatten();

        let mut last_id_val = None;
        if let Some(r) = row_opt {
            if let Ok(val) = r.try_get::<u64, _>(0) {
                last_id_val = Some(serde_json::Value::Number(val.into()));
            } else if let Ok(val) = r.try_get::<i64, _>(0) {
                last_id_val = Some(serde_json::Value::Number(val.into()));
            } else if let Ok(val) = r.try_get::<f64, _>(0) {
                if let Some(num) = serde_json::Number::from_f64(val) {
                    last_id_val = Some(serde_json::Value::Number(num));
                }
            } else if let Ok(val) = r.try_get::<String, _>(0) {
                last_id_val = Some(serde_json::Value::String(val));
            }
        }

        result.insert(table_name.clone(), TableLastIdInfo {
            table: table_name.clone(),
            primary_key: effective_pk,
            last_id: last_id_val,
        });
    }

    pool.close().await;
    Ok(result)
}

pub async fn query_local_tables(config: &LocalDbConfig) -> Result<Vec<String>, String> {
    let conn_str = build_connection_string(config);
    let pool = MySqlPoolOptions::new()
        .max_connections(2)
        .connect(&conn_str)
        .await
        .map_err(|e| format!("Koneksi ke MySQL lokal gagal: {}", e))?;

    let rows = sqlx::query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME ASC")
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("Gagal membaca daftar tabel lokal: {}", e))?;

    pool.close().await;

    let mut tables = Vec::new();
    for row in rows {
        if let Ok(name) = row.try_get::<String, _>(0) {
            tables.push(name);
        }
    }
    Ok(tables)
}

pub async fn execute_drop_tables(config: &LocalDbConfig, tables: Vec<String>) -> Result<Vec<String>, String> {
    if tables.is_empty() {
        return Ok(Vec::new());
    }

    let conn_str = build_connection_string(config);
    let pool = MySqlPoolOptions::new()
        .max_connections(2)
        .connect(&conn_str)
        .await
        .map_err(|e| format!("Koneksi ke MySQL lokal gagal: {}", e))?;

    let mut conn = pool.acquire().await.map_err(|e| format!("Koneksi ke MySQL lokal gagal: {}", e))?;
    let _ = sqlx::query("SET FOREIGN_KEY_CHECKS=0").execute(&mut *conn).await;

    let mut dropped = Vec::new();
    for table_name in tables {
        let safe_table = match sanitize_identifier(&table_name) {
            Ok(s) => s,
            Err(_) => continue,
        };
        let query = format!("DROP TABLE IF EXISTS {}", safe_table);
        if let Err(e) = sqlx::query(&query).execute(&mut *conn).await {
            eprintln!("Gagal drop tabel lokal {}: {}", table_name, e);
        } else {
            dropped.push(table_name);
        }
    }

    let _ = sqlx::query("SET FOREIGN_KEY_CHECKS=1").execute(&mut *conn).await;
    drop(conn);
    pool.close().await;
    Ok(dropped)
}

