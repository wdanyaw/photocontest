// GET /api/winners — архив победителей всех прошедших конкурсов.

import { bitrix, bxField, json, jsonError } from './_bitrix.js';

export async function onRequestGet({ env, data }) {
  try {
    const toUpperField = f => f.replace(/^ufCrm(\d+)_/, (_, n) => `UF_CRM_${n}_`);

    const res = await bitrix(env, 'crm.item.list', {
      entityTypeId: env.ENTITY_TYPE_ID,
      filter: {
        stageId: env.WINNER_STAGE_ID,
        [toUpperField(env.FIELD_IS_WINNER)]: 'Y',
      },
      order: { [toUpperField(env.FIELD_CONTEST_DATE)]: 'desc' },
    });

    const items = res.items || [];
    const groups = new Map();

    for (const item of items) {
      const contestNum = bxField(item, env.FIELD_CONTEST_NUM) ?? 'unknown';
      const key = String(contestNum);
      if (!groups.has(key)) {
        groups.set(key, {
          contestNum,
          date: bxField(item, env.FIELD_CONTEST_DATE) || null,
          winners: [],
        });
      }
      groups.get(key).winners.push({
        id: String(item.id),
        photoUrl: `/api/photo/${item.id}?auth_id=${encodeURIComponent(data.authId)}&domain=${encodeURIComponent(data.domain)}`,
        caption: bxField(item, env.FIELD_CAPTION) || '',
        participantNum: bxField(item, env.FIELD_PARTICIPANT_NUM) ?? null,
        voteCount: Number(bxField(item, env.FIELD_VOTE_COUNT) || 0),
        name: bxField(item, env.FIELD_NAME) || '',
      });
    }

    const contests = Array.from(groups.values()).sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return db - da;
    });

    return json({ contests });
  } catch {
    return jsonError(500, 'Внутренняя ошибка сервера');
  }
}
