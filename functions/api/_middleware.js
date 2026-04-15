// Middleware для всех /api/* роутов.
// Извлекает auth_id и domain из запроса, валидирует их через Bitrix24,
// и передаёт user_id в data для дальнейшего использования в роутах.

import { validateAuth, jsonError } from './_bitrix.js';

export async function onRequest(context) {
  const { request, next, data } = context;

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const url = new URL(request.url);
  let authId, domain;

  if (request.method === 'GET') {
    authId = url.searchParams.get('auth_id');
    domain = url.searchParams.get('domain');
  } else {
    // Клонируем запрос чтобы body был доступен в обработчике
    const cloned = request.clone();
    try {
      const body = await cloned.json();
      authId = body.auth_id;
      domain = body.domain;
    } catch {
      return jsonError(400, 'Invalid JSON body');
    }
  }

  if (!authId || !domain) {
    return jsonError(401, 'auth_id и domain обязательны');
  }

  // Валидация домена: должен заканчиваться на .bitrix24.ru / .bitrix24.com и т.п.
  if (!/^[a-z0-9-]+\.bitrix24\.[a-z]+$/i.test(domain)) {
    return jsonError(400, 'Некорректный домен Bitrix24');
  }

  const userId = await validateAuth(domain, authId);
  if (!userId) {
    return jsonError(401, 'Невалидный auth_id Bitrix24');
  }

  data.userId = userId;
  data.domain = domain;
  data.authId = authId;

  return next();
}
