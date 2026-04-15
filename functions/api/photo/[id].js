// GET /api/photo/:id — прокси для файла-фото с элемента смарт-процесса.
// Скрывает URL вебхука от клиента. Кэширует на 1 день.

import { bitrix } from '../_bitrix.js';

export async function onRequestGet({ params, env }) {
  try {
    const id = params.id;

    // 1. Получаем элемент чтобы узнать fileId
    const item = await bitrix(env, 'crm.item.get', {
      entityTypeId: env.ENTITY_TYPE_ID,
      id,
    });

    const photoField = item.item?.[env.FIELD_PHOTO];
    const file = Array.isArray(photoField) ? photoField[0] : photoField;
    if (!file) return new Response('Not found', { status: 404 });

    const fileId = file.id;
    if (!fileId) return new Response('Нет fileId', { status: 500 });

    // 2. Скачиваем файл через crm.controller.item.getFile
    const webhookUrl = env.BITRIX_WEBHOOK_URL.replace(/\/$/, '');
    const fileUrl = `${webhookUrl}/crm.controller.item.getFile/?entityTypeId=${env.ENTITY_TYPE_ID}&id=${id}&fieldName=${env.FIELD_PHOTO}&fileId=${fileId}`;

    const photoRes = await fetch(fileUrl);
    if (!photoRes.ok) {
      return new Response(`Ошибка загрузки фото: ${photoRes.status}`, { status: 502 });
    }

    const contentType = photoRes.headers.get('Content-Type') || '';

    return new Response(photoRes.body, {
      headers: {
        'Content-Type': contentType.includes('image') ? contentType : 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}
