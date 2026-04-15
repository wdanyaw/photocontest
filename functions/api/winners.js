// GET /api/winners — архив победителей всех прошедших конкурсов.
// Читаем из WINNER_STAGE_ID элементы с Победитель=Да, группируем по номеру конкурса.

import { bitrix, json, jsonError } from './_bitrix.js';

export async function onRequestGet({ env, data }) {
  try {
    const res = await bitrix(env, 'crm.item.list', {
      entityTypeId: env.ENTITY_TYPE_ID,
      filter: {
        stageId: env.WINNER_STAGE_ID,
        [env.FIELD_IS_WINNER]: 'Y',
      },
      order: { [env.FIELD_CONTEST_DATE]: 'desc' },
    });

    const items = res.items || [];
    const groups = new Map();

    for (const item of items) {
      const contestNum = item[env.FIELD_CONTEST_NUM] ?? 'unknown';
      const key = String(contestNum);
      if (!groups.has(key)) {
        groups.set(key, {
          contestNum,
          date: item[env.FIELD_CONTEST_DATE] || null,
          winners: [],
        });
      }
      groups.get(key).winners.push({
        id: String(item.id),
        photoUrl: `/api/photo/${item.id}?auth_id=${encodeURIComponent(data.authId)}&domain=${encodeURIComponent(data.domain)}`,
        caption: item[env.FIELD_CAPTION] || '',
        participantNum: item[env.FIELD_PARTICIPANT_NUM] ?? null,
        voteCount: Number(item[env.FIELD_VOTE_COUNT] || 0),
        name: item[env.FIELD_NAME] || '',
      });
    }

    // Сортируем от новой даты к старой
    const contests = Array.from(groups.values()).sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return db - da;
    });

    return json({ contests });
  } catch (e) {
    return jsonError(500, e.message);
  }
}
