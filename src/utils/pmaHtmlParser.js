/**
 * PMA HTML & JSON parsing utilities
 */

export const cleanFieldName = (name) => {
  if (!name || typeof name !== 'string') return name;
  return name.replace(/\s+\d+$/, '').trim();
};

export const isValidTableName = (name) => {
  if (!name || typeof name !== 'string') return false;
  const n = name.trim();
  if (n.length < 2 || n.length > 64) return false;
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(n)) return false;
  const reserved = new Set([
    'phpmyadmin', 'index', 'true', 'false', 'select', 'structure',
    'sql', 'export', 'import', 'checkall', 'select_all', 'uncheck_all',
    'none', 'null', 'yes', 'no', 'ok', 'on', 'off', 'go',
    'db', 'server', 'action', 'table', 'tables', 'table_name', 'tables_in',
    'view', 'views', 'all', 'new', 'browse', 'search', 'empty', 'drop', 'operations',
    'ansi', 'db2', 'maxdb', 'mssql', 'mysql323', 'mysql40', 'oracle',
    'traditional', 'insert', 'replace', 'update', 'structure_and_data',
    'texytext', 'textext', 'toon', 'win', 'xml', 'yaml', 'zip',
    'gzip', 'bzip2', 'codegen', 'csv', 'excel', 'htmldir', 'htmlword',
    'json', 'latex', 'mediawiki', 'ods', 'odt', 'pdf', 'phparray',
    'shift_jis', 'sjis', 'utf8', 'utf8mb4', 'latin1', 'ascii',
    'quick', 'custom', 'quick_export', 'sendit', 'asfile',
  ]);
  return !reserved.has(n.toLowerCase());
};

export const extractPmaError = (html) => {
  if (!html) return '';
  const cleanHtml = html.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
  const matches = cleanHtml.matchAll(/class=["'](?:alert alert-danger|error|message error)["'][^>]*>([\s\S]*?)<\/div>/gi);
  for (const match of matches) {
    const text = match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (text &&
        !text.includes('Javascript must be enabled') &&
        !text.includes('mismatch between HTTPS') &&
        text.length < 500) {
      return text;
    }
  }
  if (cleanHtml.includes('Cannot log in to the database server') || cleanHtml.includes('Cannot log in to the MySQL server')) {
    return 'Cannot log in to the database server (koneksi MySQL ditolak)';
  }
  if (cleanHtml.includes('Access denied')) {
    return 'Access denied (Username atau Password salah)';
  }
  return '';
};

export const extractTokenFromHtml = (html) => {
  if (!html) return '';
  const tokenMatch = html.match(/name=["']token["']\s+value=["']([^"']+)["']/i) ||
                     html.match(/value=["']([^"']+)["']\s+name=["']token["']/i) ||
                     html.match(/data-token=["']([^"']+)["']/i) ||
                     html.match(/["']token["']:\s*["']([^"']+)["']/i) ||
                     html.match(/CommonParams\.set\(\s*["']token["']\s*,\s*["']([^"']+)["']/i) ||
                     html.match(/token=([a-zA-Z0-9_-]{16,})/i) ||
                     html.match(/pma_token\s*=\s*["']([^"']+)["']/i);
  return tokenMatch ? tokenMatch[1] : '';
};

export const extractTablesFromStructureJson = (payload) => {
  const tables = [];
  const walk = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (typeof value !== 'object') return;

    const directName = value.table_name || value.TABLE_NAME || value.Name || value.name || value.Table || value.table || null;
    if (typeof directName === 'string' && directName.trim()) {
      tables.push(directName.trim());
    }

    for (const key of Object.keys(value)) {
      const nested = value[key];
      if (key === 'tables' || key === 'tbl_group' || key === 'data' || key === 'rows' || key === 'results' || key === 'items') {
        walk(nested);
      } else if (nested && typeof nested === 'object') {
        walk(nested);
      }
    }
  };

  walk(payload);
  return Array.from(new Set(tables)).map((t) => ({ table_name: t }));
};

export const extractTablesFromHtmlFallback = (html) => {
  const tableNames = new Set();
  if (!html) return tableNames;

  for (const match of html.matchAll(/(?:data-table|data-name|data-filter-row)="([^"]+)"/gi)) {
    if (isValidTableName(match[1])) tableNames.add(match[1].trim());
  }

  const tableSelectMatch = html.match(/<select[^>]*name=["']table_select[^"']*["'][^>]*>([\s\S]*?)<\/select>/i);
  if (tableSelectMatch && tableSelectMatch[1]) {
    for (const match of tableSelectMatch[1].matchAll(/value=["']([^"']+)["']/gi)) {
      if (isValidTableName(match[1])) tableNames.add(match[1].trim());
    }
  }

  for (const match of html.matchAll(/(?:selected_tbl|table_select|table_structure|table_data)[^>]*value=["']([^"']+)["']/gi)) {
    if (isValidTableName(match[1])) tableNames.add(match[1].trim());
  }
  for (const match of html.matchAll(/value=["']([^"']+)["'][^>]*(?:selected_tbl|table_select)/gi)) {
    if (isValidTableName(match[1])) tableNames.add(match[1].trim());
  }

  for (const match of html.matchAll(/[?&](?:table|dbtable)=([a-zA-Z_][a-zA-Z0-9_]*)/gi)) {
    if (isValidTableName(match[1])) tableNames.add(match[1].trim());
  }

  for (const match of html.matchAll(/<td[^>]*class=["'][^"']*data[^"']*["'][^>]*>(?:<[^>]+>)*\s*([a-zA-Z0-9_]{2,64})\s*(?:<\/[^>]+>)*<\/td>/gi)) {
    if (isValidTableName(match[1])) tableNames.add(match[1].trim());
  }

  for (const match of html.matchAll(/hover_show_full[^>]*title=["']([^"']+)["']/gi)) {
    if (isValidTableName(match[1])) tableNames.add(match[1].trim());
  }

  return tableNames;
};

