// GET /api/photo/:id — прокси для файла-фото с элемента смарт-процесса.
// Скрывает URL вебхука от клиента. Кэширует на 1 день.

import { bitrix } from '../_bitrix.js';

export async function onRequestGet({ params, env }) {
  try {
    const id = params.id;
    const item = await bitrix(env, 'crm.item.get', {
      entityTypeId: env.ENTITY_TYPE_ID,
      id,
    });

    const photoField = item.item?.[env.FIELD_PHOTO];
    const file = Array.isArray(photoField) ? photoField[0] : photoField;
    if (!file) return new Response('Not found', { status: 404 });

    // Bitrix24 возвращает urlMachine (относительный URL) или downloadUrl.
    // urlMachine чаще всего требует ту же авторизацию что и вебхук.
    const rawUrl = file.urlMachine || file.downloadUrl || file.url;
    if (!rawUrl) return new Response('Нет URL для файла', { status: 500 });

    // Если URL относительный, подставляем домен из вебхука
    const portalOrigin = new URL(env.BITRIX_WEBHOOK_URL).origin;
    const fullUrl = rawUrl.startsWith('http') ? rawUrl : `${portalOrigin}${rawUrl}`;

    const photoRes = await fetch(fullUrl);
    if (!photoRes.ok) {
      return new Response(`Ошибка загрузки фото: ${photoRes.status}`, { status: 502 });
    }

    return new Response(photoRes.body, {
      headers: {
        'Content-Type': photoRes.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}
