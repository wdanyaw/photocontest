// GET /api/photo/:id — прокси для файла-фото с элемента смарт-процесса.
// Вебхук скрыт полностью — клиент видит только /api/photo/:id.
// fileId кэшируется в D1 чтобы не ходить в Bitrix24 лишний раз.

import { bitrix, bxField } from '../_bitrix.js';

export async function onRequestGet({ params, env }) {
  try {
    const id = params.id;

    // 1. Пробуем взять fileId из кэша D1
    let fileId = null;
    const cached = await env.DB.prepare(
      'SELECT file_id FROM photo_cache WHERE participant_id = ?'
    ).bind(id).first();

    if (cached) {
      fileId = cached.file_id;
    } else {
      // Кэша нет — запрашиваем элемент из Bitrix24
      const item = await bitrix(env, 'crm.item.get', {
        entityTypeId: env.ENTITY_TYPE_ID,
        id,
      });

      const photoField = bxField(item.item, env.FIELD_PHOTO);
      const file = Array.isArray(photoField) ? photoField[0] : photoField;
      if (!file) return new Response('Not found', { status: 404 });

      fileId = String(file.id);
      if (!fileId) return new Response('Нет fileId', { status: 500 });

      // Сохраняем в кэш
      await env.DB.prepare(
        'INSERT OR REPLACE INTO photo_cache (participant_id, file_id) VALUES (?, ?)'
      ).bind(id, fileId).run();
    }

    // 2. Скачиваем файл целиком через arrayBuffer — стабильнее стриминга
    const webhookUrl = env.BITRIX_WEBHOOK_URL.replace(/\/$/, '');
    const fieldNameForApi = env.FIELD_PHOTO.replace(/^ufCrm(\d+)_/, (_, n) => `UF_CRM_${n}_`);
    const fileUrl = `${webhookUrl}/crm.controller.item.getFile/?entityTypeId=${env.ENTITY_TYPE_ID}&id=${id}&fieldName=${fieldNameForApi}&fileId=${fileId}`;

    const photoRes = await fetch(fileUrl);
    if (!photoRes.ok) {
      // Кэш мог устареть — сбрасываем
      if (cached) {
        await env.DB.prepare('DELETE FROM photo_cache WHERE participant_id = ?').bind(id).run();
      }
      return new Response('Ошибка загрузки фото', { status: 502 });
    }

    const contentType = photoRes.headers.get('Content-Type') || 'image/jpeg';
    const buffer = await photoRes.arrayBuffer();

    return new Response(buffer, {
      headers: {
        'Content-Type': contentType.includes('image') ? contentType : 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return new Response('Internal error', { status: 500 });
  }
}
