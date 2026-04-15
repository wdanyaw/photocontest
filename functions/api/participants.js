// GET /api/participants — возвращает участников текущего конкурса (стадия 3).
// Имена НЕ возвращаются пока голосование активно — для анонимности.

import { bitrix, json, jsonError } from './_bitrix.js';

export async function onRequestGet({ env, data }) {
  try {
    // Проверим фазу: имена можно показывать только после закрытия голосования
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

    // Проверим, голосовал ли текущий пользователь
    const contestId = items[0]?.[env.FIELD_CONTEST_NUM];
    let userVote = null;
    if (contestId != null) {
      const voteRow = await env.DB.prepare(
        'SELECT participant_id FROM votes WHERE user_id = ? AND contest_id = ?'
      ).bind(data.userId, String(contestId)).first();
      if (voteRow) userVote = voteRow.participant_id;
    }

    const participants = items.map(item => ({
      id: String(item.id),
      // Фото отдаём через proxy /api/photo/:id чтобы не светить вебхук
      photoUrl: `/api/photo/${item.id}?auth_id=${encodeURIComponent(data.authId)}&domain=${encodeURIComponent(data.domain)}`,
      caption: item[env.FIELD_CAPTION] || '',
      participantNum: item[env.FIELD_PARTICIPANT_NUM] ?? null,
      voteCount: Number(item[env.FIELD_VOTE_COUNT] || 0),
      name: isVoting ? null : (item[env.FIELD_NAME] || null),
    }));

    return json({
      participants,
      contestId: contestId != null ? String(contestId) : null,
      userVote,
      isVoting,
    });
  } catch (e) {
    return jsonError(500, e.message);
  }
}
