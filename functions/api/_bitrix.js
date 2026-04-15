// Вспомогательные функции для работы с Bitrix24 REST API через входящий вебхук.
// Вебхук хранится в env.BITRIX_WEBHOOK_URL (Cloudflare Secret) — в клиент не попадает.

function buildQuery(params) {
  const parts = [];
  function encode(key, val) {
    if (val === null || val === undefined) return;
    if (Array.isArray(val)) {
      val.forEach((v, i) => encode(`${key}[${i}]`, v));
    } else if (typeof val === 'object') {
      for (const [k, v] of Object.entries(val)) encode(`${key}[${k}]`, v);
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`);
    }
  }
  for (const [k, v] of Object.entries(params)) encode(k, v);
  return parts.join('&');
}

// Одиночный вызов REST-метода.
export async function bitrix(env, method, params = {}) {
  if (!env.BITRIX_WEBHOOK_URL) {
    throw new Error('BITRIX_WEBHOOK_URL не задан (wrangler pages secret put BITRIX_WEBHOOK_URL)');
  }
  const url = `${env.BITRIX_WEBHOOK_URL.replace(/\/$/, '')}/${method}.json`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: buildQuery(params),
  });
  const json = await res.json();
  if (json.error) {
    throw new Error(`Bitrix24: ${json.error_description || json.error}`);
  }
  return json.result;
}

// Пакетный вызов (до 50 методов за один HTTP-запрос).
// cmd — { key: { method, params } }
export async function bitrixBatch(env, cmd) {
  const body = new URLSearchParams();
  for (const [key, { method, params }] of Object.entries(cmd)) {
    body.append(`cmd[${key}]`, `${method}?${buildQuery(params)}`);
  }
  const url = `${env.BITRIX_WEBHOOK_URL.replace(/\/$/, '')}/batch.json`;
  const res = await fetch(url, { method: 'POST', body });
  const json = await res.json();
  if (json.error) {
    throw new Error(`Bitrix24 batch: ${json.error_description || json.error}`);
  }
  return json.result;
}

// Валидация AUTH_ID через Bitrix24 profile endpoint.
// Возвращает user_id если токен валидный, иначе null.
export async function validateAuth(domain, authId) {
  if (!domain || !authId) return null;
  try {
    const res = await fetch(
      `https://${domain}/rest/profile.json?auth=${encodeURIComponent(authId)}`
    );
    const json = await res.json();
    if (json.result?.ID) return String(json.result.ID);
    return null;
  } catch {
    return null;
  }
}

// Конвертирует имя поля из верхнего регистра в camelCase как возвращает Bitrix24 REST API.
// UF_CRM_22_1776281092 → ufCrm22_1776281092
export function bxField(item, fieldName) {
  if (!fieldName) return undefined;
  // Попробуем как есть
  if (item[fieldName] !== undefined) return item[fieldName];
  // Конвертируем UF_CRM_N_xxx → ufCrmN_xxx
  const camel = fieldName.replace(/^UF_CRM_(\d+)_/, (_, n) => `ufCrm${n}_`);
  return item[camel];
}

// Универсальный JSON-ответ.
export function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    },
  });
}

export function jsonError(status, message) {
  return json({ error: message }, status);
}
