// GET /api/photo/:id — прокси для файла-фото с элемента смарт-процесса.
// Скрывает URL вебхука от клиента. Кэширует на 1 день.

export async function onRequestGet({ params, env }) {
  try {
    const id = params.id;

    // Получаем файл напрямую через crm.controller.item.getFile
    const webhookUrl = env.BITRIX_WEBHOOK_URL.replace(/\/$/, '');
    const fileUrl = `${webhookUrl}/crm.controller.item.getFile/?entityTypeId=${env.ENTITY_TYPE_ID}&id=${id}&fieldName=${env.FIELD_PHOTO}`;

    const photoRes = await fetch(fileUrl);
    if (!photoRes.ok) {
      return new Response(`Ошибка загрузки фото: ${photoRes.status}`, { status: 502 });
    }

    const contentType = photoRes.headers.get('Content-Type') || '';

    // Если вернулся JSON — значит это не файл, а ошибка или редирект
    if (contentType.includes('application/json')) {
      const json = await photoRes.json();
      // Bitrix24 может вернуть {result: {url: "..."}} или редирект-ссылку
      const downloadUrl = json?.result?.url || json?.result?.urlMachine || json?.result;
      if (typeof downloadUrl === 'string' && downloadUrl.startsWith('http')) {
        const fileRes = await fetch(downloadUrl);
        if (!fileRes.ok) {
          return new Response(`Ошибка загрузки файла: ${fileRes.status}`, { status: 502 });
        }
        return new Response(fileRes.body, {
          headers: {
            'Content-Type': fileRes.headers.get('Content-Type') || 'image/jpeg',
            'Cache-Control': 'public, max-age=86400',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
      return new Response('Не удалось получить URL файла', { status: 500 });
    }

    // Файл получен напрямую
    return new Response(photoRes.body, {
      headers: {
        'Content-Type': contentType || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}
