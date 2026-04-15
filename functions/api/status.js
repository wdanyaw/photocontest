// GET /api/status — определяет текущую фазу конкурса.
// VOTING — основная карточка на STAGE_2_ID
// IDLE   — иначе

import { bitrix, json, jsonError } from './_bitrix.js';

export async function onRequestGet({ env }) {
  try {
    const mainCard = await bitrix(env, 'crm.item.get', {
      entityTypeId: env.ENTITY_TYPE_ID,
      id: env.MAIN_CARD_ID,
    });

    const stageId = mainCard.item?.stageId;
    const phase = stageId === env.STAGE_2_ID ? 'VOTING' : 'IDLE';
    return json({ phase });
  } catch {
    return jsonError(500, 'Внутренняя ошибка сервера');
  }
}
