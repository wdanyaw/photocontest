// GET /api/photo/:id — редирект на файл-фото с элемента смарт-процесса.
// Вебхук не утекает — клиент получает только временный URL файла.
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

    // 2. Строим URL файла и делаем redirect — браузер скачивает напрямую
    const webhookUrl = env.BITRIX_WEBHOOK_URL.replace(/\/$/, '');
    const fieldNameForApi = env.FIELD_PHOTO.replace(/^ufCrm(\d+)_/, (_, n) => `UF_CRM_${n}_`);
    const fileUrl = `${webhookUrl}/crm.controller.item.getFile/?entityTypeId=${env.ENTITY_TYPE_ID}&id=${id}&fieldName=${fieldNameForApi}&fileId=${fileId}`;

    return Response.redirect(fileUrl, 302);
  } catch {
    return new Response('Internal error', { status: 500 });
  }
}
