import { safeFetch } from './tauriHelper.js';
import { updateCookieHeader } from '../utils/cookieHelper.js';
import {
  cleanFieldName,
  isValidTableName,
  extractPmaError,
  extractTokenFromHtml,
  extractTablesFromHtmlFallback,
} from '../utils/pmaHtmlParser.js';

/**
 * PhpMyAdmin HTTP Native Client Service
 * Handles authentication, CSRF token management, and query execution against remote PMA servers.
 */
export class PmaClient {
  constructor(config) {
    this.baseUrl = config.url ? config.url.trim().replace(/\/index\.php.*$/, '').replace(/\/$/, '') : '';
    this.username = (config.username || '').trim();
    this.password = config.password || '';
    this.database = (config.database || '').trim();
    this.table = (config.table || '').trim();
    this.primaryKey = config.primaryKey || 'id';
    this.cookieHeader = '';
    this.token = '';
  }

  getEndpoint(path = '') {
    const base = this.activeBaseUrl || this.baseUrl;
    if (!path) return base;
    return `${base}/${path.replace(/^\//, '')}`;
  }

  updateCookies(responseHeaders) {
    this.cookieHeader = updateCookieHeader(this.cookieHeader, responseHeaders);
  }

  /**
   * Authenticate with remote PhpMyAdmin server & obtain session tokens
   */
  async authenticate() {
    if (!this.baseUrl) {
      throw new Error('URL PhpMyAdmin belum diisi.');
    }

    try {
      let currentUrl = this.getEndpoint('index.php');
      let initRes = await safeFetch(currentUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DB-Sync-Client/1.0',
        },
      });

      let initHtml = await initRes.text();

      const metaRedirect = initHtml.match(/<meta[^>]*http-equiv=["']?Refresh["']?[^>]*content=["'][^"']*url=([^"';\s>]+)/i) ||
                           initHtml.match(/(?:window\.)?location(?:\.href)?\s*=\s*(?:decodeURI\()?["']([^"']+)["']/i) ||
                           initHtml.match(/location\.replace\s*\(\s*["']([^"']+)["']/i);

      if (metaRedirect && metaRedirect[1]) {
        const redirectPath = metaRedirect[1].trim();
        const resolvedUrl = new URL(redirectPath, currentUrl).href;
        this.activeBaseUrl = resolvedUrl.replace(/\/index\.php.*$/, '').replace(/\/$/, '');

        initRes = await safeFetch(resolvedUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DB-Sync-Client/1.0',
          },
        });
        initHtml = await initRes.text();
        currentUrl = resolvedUrl;
      }

      this.updateCookies(initRes.headers);
      this.token = extractTokenFromHtml(initHtml);

      const loginEndpoints = [
        this.getEndpoint('index.php?route=/'),
        this.getEndpoint('index.php'),
      ];

      let lastError = null;

      for (const loginUrl of loginEndpoints) {
        try {
          const body = new URLSearchParams();
          body.append('pma_username', this.username);
          body.append('pma_password', this.password);
          body.append('server', '1');
          body.append('target', 'index.php');
          if (this.token) {
            body.append('token', this.token);
            body.append('set_session', this.token);
          }

          const loginRes = await safeFetch(loginUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DB-Sync-Client/1.0',
              ...(this.cookieHeader ? { Cookie: this.cookieHeader } : {}),
            },
            body: body.toString(),
          });

          this.updateCookies(loginRes.headers);
          const loginHtml = await loginRes.text();

          const newToken = extractTokenFromHtml(loginHtml);
          if (newToken) {
            this.token = newToken;
          }

          const pmaError = extractPmaError(loginHtml);
          if (pmaError) {
            lastError = new Error(pmaError);
            continue;
          }

          const isSuccess =
            loginRes.status === 200 ||
            loginRes.status === 302 ||
            loginHtml.includes('database_structure') ||
            loginHtml.includes('server_databases') ||
            loginHtml.includes('server_status') ||
            loginHtml.includes('pma_navigation') ||
            loginHtml.includes('logout') ||
            loginHtml.includes('Log out');

          if (isSuccess) {
            return {
              success: true,
              message: 'Autentikasi PMA berhasil.',
              token: this.token,
            };
          }

          lastError = new Error('Gagal login ke PhpMyAdmin (Autentikasi ditolak)');
        } catch (err) {
          lastError = err;
        }
      }

      throw lastError || new Error('Autentikasi gagal pada semua endpoint login PMA.');
    } catch (err) {
      throw new Error(`Koneksi PMA gagal: ${err.message || err}`);
    }
  }

  /**
   * Fetch list of tables existing in remote PMA database.
   */
  async fetchTablesList() {
    if (!this.database) {
      throw new Error('Nama database remote PMA belum dikonfigurasi.');
    }

    let rawRows = [];
    const escapedDb = this.database.replace(/`/g, '``').replace(/'/g, "''");
    const infoQuery = `SELECT TABLE_NAME FROM information_schema.TABLES WHERE LOWER(TABLE_SCHEMA) = LOWER('${escapedDb}') ORDER BY TABLE_NAME LIMIT 100000`;

    try {
      rawRows = await this.executePmaAjaxSql(infoQuery);
      if (rawRows && rawRows.length > 0 && rawRows.length % 250 === 0) {
        let offset = rawRows.length;
        while (offset % 250 === 0) {
          const pagedQuery = `SELECT TABLE_NAME FROM information_schema.TABLES WHERE LOWER(TABLE_SCHEMA) = LOWER('${escapedDb}') ORDER BY TABLE_NAME LIMIT 1000 OFFSET ${offset}`;
          try {
            const nextRows = await this.executePmaAjaxSql(pagedQuery);
            if (!nextRows || nextRows.length === 0) break;
            const countBefore = rawRows.length;
            rawRows.push(...nextRows);
            if (rawRows.length === countBefore) break;
            offset = rawRows.length;
          } catch (_) {
            break;
          }
        }
      }
    } catch (err) {
      console.warn('[fetchTablesList] information_schema query failed:', err.message);
    }

    if (!rawRows || rawRows.length === 0) {
      try {
        rawRows = await this.executePmaAjaxSql(`SHOW FULL TABLES FROM \`${escapedDb}\` WHERE Table_type = 'BASE TABLE'`);
      } catch (err) {
        console.warn('[fetchTablesList] SHOW FULL TABLES query failed:', err.message);
      }
    }

    if (!rawRows || rawRows.length === 0) {
      try {
        rawRows = await this.executePmaAjaxSql(`SHOW TABLES FROM \`${escapedDb}\``);
      } catch (err) {
        console.warn('[fetchTablesList] SHOW TABLES query failed:', err.message);
      }
    }

    if (!rawRows || rawRows.length === 0) {
      try {
        const tokenParam = this.token ? `&token=${encodeURIComponent(this.token)}` : '';
        const candidateUrls = [
          this.getEndpoint(`index.php?route=/database/structure&db=${encodeURIComponent(this.database)}&server=1${tokenParam}`),
          this.getEndpoint(`db_structure.php?db=${encodeURIComponent(this.database)}&server=1${tokenParam}`),
          this.getEndpoint(`index.php?route=/navigation&db=${encodeURIComponent(this.database)}&server=1${tokenParam}`),
          this.getEndpoint(`navigation.php?db=${encodeURIComponent(this.database)}&server=1${tokenParam}`),
          this.getEndpoint(`index.php?route=/database/export&db=${encodeURIComponent(this.database)}&server=1&export_type=database${tokenParam}`),
          this.getEndpoint(`export.php?db=${encodeURIComponent(this.database)}&server=1&export_type=database${tokenParam}`),
        ];

        const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' };
        if (this.cookieHeader) headers.Cookie = this.cookieHeader;

        for (const url of candidateUrls) {
          try {
            const databaseRes = await safeFetch(url, { method: 'GET', headers });
            const databaseHtml = await databaseRes.text();
            const extracted = extractTablesFromHtmlFallback(databaseHtml);
            if (extracted.size > 0) {
              rawRows = Array.from(extracted, (table_name) => ({ table_name }));
              break;
            }
          } catch (e) {
            console.warn(`[fetchTablesList] URL ${url} failed:`, e.message);
          }
        }
      } catch (err) {
        console.warn('[fetchTablesList] database page fallback failed:', err.message);
      }
    }

    if (!rawRows || !Array.isArray(rawRows)) return [];

    const tables = [];
    for (const row of rawRows) {
      let value = null;
      if (typeof row === 'string') {
        value = row;
      } else if (row && typeof row === 'object') {
        value = row.TABLE_NAME ?? row.table_name ?? row.Tables_in_db ?? row.Name ?? row.name ?? null;
      }

      if (isValidTableName(value)) {
        tables.push(value.trim());
      }
    }

    return Array.from(new Set(tables)).sort();
  }

  /**
   * Execute SQL query via PMA AJAX SQL execution route
   */
  async executePmaAjaxSql(sqlQuery) {
    const endpoints = [
      this.getEndpoint('index.php?route=/sql'),
      this.getEndpoint('sql.php'),
    ];

    const formData = new URLSearchParams();
    formData.append('db', this.database);
    formData.append('table', this.table || '');
    formData.append('server', '1');
    formData.append('sql_query', sqlQuery);
    formData.append('sql_delimiter', ';');
    formData.append('ajax_request', 'true');
    formData.append('submit_query', 'Go');
    formData.append('session_max_rows', 'all');
    formData.append('max_rows', '100000');
    formData.append('limit', '100000');
    if (this.token) formData.append('token', this.token);

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'X-Requested-With': 'XMLHttpRequest',
      ...(this.cookieHeader ? { Cookie: this.cookieHeader } : {}),
    };

    let rawText = '';

    for (const sqlUrl of endpoints) {
      try {
        const res = await safeFetch(sqlUrl, {
          method: 'POST',
          headers,
          body: formData.toString(),
        });
        rawText = await res.text();
        if (rawText && !rawText.includes('Cannot POST') && !rawText.includes('404 Not Found')) {
          break;
        }
      } catch (err) {
        console.warn(`[PMA] executePmaAjaxSql error on ${sqlUrl}:`, err.message);
      }
    }

    if (!rawText) return [];

    let resData = null;
    try {
      resData = JSON.parse(rawText);
    } catch (_) {
      const htmlMatches = new Set();
      for (const m of rawText.matchAll(/<td[^>]*class=["'][^"']*data[^"']*["'][^>]*>(?:<[^>]+>)*\s*([a-zA-Z0-9_]{2,64})\s*(?:<\/[^>]+>)*<\/td>/gi)) {
        htmlMatches.add(m[1].trim());
      }
      return Array.from(htmlMatches).map((t) => ({ table_name: t }));
    }

    if (!resData) return [];

    if (resData.success === false) {
      const errMsg = resData.error || resData.message || 'Unknown PMA error';
      throw new Error(errMsg.replace(/<[^>]*>/g, '').trim());
    }

    if (typeof resData.message === 'string' && resData.message.includes('<')) {
      const htmlMatches = new Set();
      for (const m of resData.message.matchAll(/<td[^>]*class=["'][^"']*data[^"']*["'][^>]*>(?:<[^>]+>)*\s*([a-zA-Z0-9_]{2,64})\s*(?:<\/[^>]+>)*<\/td>/gi)) {
        htmlMatches.add(m[1].trim());
      }
      for (const m of resData.message.matchAll(/<td[^>]*>(?:<[^>]+>)*\s*([a-zA-Z0-9_]{2,64})\s*(?:<\/[^>]+>)*<\/td>/gi)) {
        htmlMatches.add(m[1].trim());
      }
      if (htmlMatches.size > 0) {
        return Array.from(htmlMatches).map((t) => ({ table_name: t }));
      }
    }

    const normalizeRows = (payload) => {
      if (!payload) return [];
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload.fields) && Array.isArray(payload.rows)) {
        const names = payload.fields.map((field) => cleanFieldName(
          typeof field === 'object' ? (field.name || field.Name || field.Field || '') : String(field)
        ));
        return payload.rows.map((row) => {
          if (!Array.isArray(row)) return row;
          return Object.fromEntries(names.map((name, index) => [name, row[index] ?? null]));
        });
      }
      for (const value of Object.values(payload)) {
        if (value && typeof value === 'object') {
          const rows = normalizeRows(value);
          if (rows.length) return rows;
        }
      }
      return [];
    };

    return normalizeRows(resData);
  }
}
