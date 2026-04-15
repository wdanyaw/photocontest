// GET /api/photo/:id — прокси для файла-фото с элемента смарт-процесса.

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
    if (!file) return new Response(JSON.stringify({ error: 'no photo field', item: item.item }), { status: 404, headers: { 'Content-Type': 'application/json' } });

    const fileId = file.id;
    if (!fileId) return new Response(JSON.stringify({ error: 'no fileId', file }), { status: 500, headers: { 'Content-Type': 'application/json' } });

    // 2. Скачиваем файл
    const webhookUrl = env.BITRIX_WEBHOOK_URL.replace(/\/$/, '');
    const fileUrl = `${webhookUrl}/crm.controller.item.getFile/?entityTypeId=${env.ENTITY_TYPE_ID}&id=${id}&fieldName=${env.FIELD_PHOTO}&fileId=${fileId}`;

    const photoRes = await fetch(fileUrl);
    if (!photoRes.ok) {
      const body = await photoRes.text();
      return new Response(JSON.stringify({ error: `fetch failed ${photoRes.status}`, body, fileUrl: fileUrl.replace(webhookUrl, 'WEBHOOK') }), { status: 502, headers: { 'Content-Type': 'application/json' } });
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
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
