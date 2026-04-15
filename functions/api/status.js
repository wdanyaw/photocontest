// GET /api/status — определяет текущую фазу конкурса.
// VOTING  — основная карточка на STAGE_2_ID
// ARCHIVE — есть элементы в WINNER_STAGE_ID
// IDLE    — иначе

import { bitrix, json, jsonError } from './_bitrix.js';

export async function onRequestGet({ env }) {
  try {
    const mainCard = await bitrix(env, 'crm.item.get', {
      entityTypeId: env.ENTITY_TYPE_ID,
      id: env.MAIN_CARD_ID,
    });

    const stageId = mainCard.item?.stageId;

    if (stageId === env.STAGE_2_ID) {
      return json({ phase: 'VOTING' });
    }

    // Проверяем архив победителей
    const winners = await bitrix(env, 'crm.item.list', {
      entityTypeId: env.ENTITY_TYPE_ID,
      filter: { stageId: env.WINNER_STAGE_ID },
      select: ['id'],
    });

    const phase = winners.items?.length > 0 ? 'ARCHIVE' : 'IDLE';
    return json({ phase });
  } catch (e) {
    return jsonError(500, e.message);
  }
}
