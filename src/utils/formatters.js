/**
 * Shared formatting utilities
 */

export const formatDate = (isoString) => {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const datePart = d.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const timePart = d.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    }).replace(/\./g, ':');
    return `${datePart}, ${timePart}`;
  } catch {
    return isoString;
  }
};

export const formatTime = (val) => {
  if (!val) return '-';
  if (typeof val === 'string') {
    if (/^\d{1,2}[.:]\d{1,2}(?:[.:]\d{1,2})?$/.test(val.trim())) {
      return val.trim().replace(/\./g, ':');
    }
  }
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('id-ID').replace(/\./g, ':');
    }
  } catch {}
  return String(val).replace(/\./g, ':');
};

export const formatNumber = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '0';
  return Number(val).toLocaleString('id-ID');
};

export const formatDuration = (ms) => {
  if (!ms || isNaN(ms)) return '-';
  if (ms < 1000) return `${ms}ms`;

  const totalSec = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;

  if (minutes === 0) {
    return `${seconds}d`;
  }
  return `${minutes}m ${seconds}d`;
};

export const formatDurationText = (ms) => {
  if (!ms || isNaN(ms)) return '0 detik';
  const totalSec = Math.round(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours} jam`);
  if (minutes > 0) parts.push(`${minutes} menit`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds} detik`);
  return parts.join(' ');
};

export const formatElapsed = (seconds) => {
  const s = seconds || 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}j ${m}m ${sec}d`;
  if (m > 0) return `${m}m ${sec}d`;
  return `${sec}d`;
};

export const formatMySQLDateTime = (date = new Date()) => {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
