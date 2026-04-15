// GET /api/participants — возвращает участников текущего конкурса (стадия 3).
// Имена НЕ возвращаются пока голосование активно — для анонимности.

import { bitrix, bxField, json, jsonError } from './_bitrix.js';

export async function onRequestGet({ env, data }) {
  try {
    const mainCard = await bitrix(env, 'crm.item.get', {
      entityTypeId: env.ENTITY_TYPE_ID,
      id: env.MAIN_CARD_ID,
    });
    const isVoting = mainCard.item?.stageId === env.STAGE_2_ID;

    const res = await bitrix(env, 'crm.item.list', {
      entityTypeId: env.ENTITY_TYPE_ID,
      filter: { stageId: env.STAGE_3_ID },
    });

    const items = res.items || [];

    const contestId = items[0] ? bxField(items[0], env.FIELD_CONTEST_NUM) : null;
    let userVote = null;
    if (contestId != null) {
      const voteRow = await env.DB.prepare(
        'SELECT participant_id FROM votes WHERE user_id = ? AND contest_id = ?'
      ).bind(data.userId, String(contestId)).first();
      if (voteRow) userVote = voteRow.participant_id;
    }

    const participants = items.map(item => ({
      id: String(item.id),
      photoUrl: `/api/photo/${item.id}?auth_id=${encodeURIComponent(data.authId)}&domain=${encodeURIComponent(data.domain)}`,
      caption: bxField(item, env.FIELD_CAPTION) || '',
      participantNum: bxField(item, env.FIELD_PARTICIPANT_NUM) ?? null,
      voteCount: Number(bxField(item, env.FIELD_VOTE_COUNT) || 0),
      name: isVoting ? null : (bxField(item, env.FIELD_NAME) || null),
    }));

    return json({
      participants,
      contestId: contestId != null ? String(contestId) : null,
      userVote,
      isVoting,
    });
  } catch {
    return jsonError(500, 'Внутренняя ошибка сервера');
  }
}
