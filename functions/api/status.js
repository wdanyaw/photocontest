// GET /api/status — определяет текущую фазу конкурса.
// VOTING  — основная карточка на STAGE_2_ID
// RESULTS — основная карточка на STAGE_4_ID
// IDLE    — иначе

import { bitrix, json, jsonError } from './_bitrix.js';

export async function onRequestGet({ env }) {
  try {
    const mainCard = await bitrix(env, 'crm.item.get', {
      entityTypeId: env.ENTITY_TYPE_ID,
      id: env.MAIN_CARD_ID,
    });

    const stageId = mainCard.item?.stageId;
    let phase = 'IDLE';
    if (stageId === env.STAGE_2_ID) phase = 'VOTING';
    else if (stageId === env.STAGE_4_ID) phase = 'RESULTS';
    return json({ phase });
  } catch {
    return jsonError(500, 'Внутренняя ошибка сервера');
  }
}
