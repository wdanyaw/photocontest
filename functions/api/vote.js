// POST /api/vote — обработка голоса.

import { bitrix, bitrixBatch, bxField, json, jsonError } from './_bitrix.js';

export async function onRequestPost({ request, env, data }) {
  try {
    const body = await request.json();
    const participantId = body.participant_id ? String(body.participant_id) : null;
    if (!participantId) return jsonError(400, 'participant_id обязателен');

    // 1. Проверяем что голосование активно
    const mainCard = await bitrix(env, 'crm.item.get', {
      entityTypeId: env.ENTITY_TYPE_ID,
      id: env.MAIN_CARD_ID,
    });
    if (mainCard.item?.stageId !== env.STAGE_2_ID) {
      return jsonError(403, 'Голосование сейчас не активно');
    }

    // 2. Получаем всех участников
    const list = await bitrix(env, 'crm.item.list', {
      entityTypeId: env.ENTITY_TYPE_ID,
      filter: { stageId: env.STAGE_3_ID },
    });
    const items = list.items || [];
    const target = items.find(p => String(p.id) === participantId);
    if (!target) return jsonError(404, 'Участник не найден в текущем конкурсе');

    const contestId = String(bxField(target, env.FIELD_CONTEST_NUM) ?? '');
    if (!contestId) return jsonError(500, 'У участника не заполнен Номер конкурса');

    // 3. Вставляем голос (UNIQUE защита от дублей)
    try {
      await env.DB.prepare(
        'INSERT INTO votes (user_id, contest_id, participant_id) VALUES (?, ?, ?)'
      ).bind(data.userId, contestId, participantId).run();
    } catch (e) {
      const msg = String(e.message || '');
      if (msg.includes('UNIQUE') || msg.includes('constraint')) {
        return jsonError(409, 'Вы уже проголосовали в этом конкурсе');
      }
      throw e;
    }

    // 4. Атомарный инкремент счётчика
    await env.DB.prepare(`
      INSERT INTO participant_counts (participant_id, contest_id, vote_count)
      VALUES (?, ?, 1)
      ON CONFLICT(participant_id, contest_id)
      DO UPDATE SET vote_count = vote_count + 1
    `).bind(participantId, contestId).run();

    // 5. Читаем счётчики, определяем победителей
    const counts = await env.DB.prepare(
      'SELECT participant_id, vote_count FROM participant_counts WHERE contest_id = ?'
    ).bind(contestId).all();

    const countsByPid = {};
    let maxVotes = 0;
    for (const row of counts.results) {
      countsByPid[row.participant_id] = row.vote_count;
      if (row.vote_count > maxVotes) maxVotes = row.vote_count;
    }

    // 6. Batch-обновляем поля в Bitrix24
    const cmd = {};
    for (const p of items) {
      const pid = String(p.id);
      const voteCount = countsByPid[pid] || 0;
      const isWinner = voteCount > 0 && voteCount === maxVotes ? 'Y' : 'N';
      cmd[`u_${pid}`] = {
        method: 'crm.item.update',
        params: {
          entityTypeId: env.ENTITY_TYPE_ID,
          id: pid,
          fields: {
            [env.FIELD_VOTE_COUNT]: voteCount,
            [env.FIELD_IS_WINNER]: isWinner,
          },
        },
      };
    }
    await bitrixBatch(env, cmd);

    return json({ success: true, counts: countsByPid, userVote: participantId });
  } catch {
    return jsonError(500, 'Внутренняя ошибка сервера');
  }
}
