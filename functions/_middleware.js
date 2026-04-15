// Глобальный middleware — перехватывает POST запросы на корневой URL.
// Bitrix24 делает POST при первом открытии серверного приложения.
// Мы просто отдаём index.html в ответ.

export async function onRequest(context) {
  const { request, next, env } = context;

  // POST на корневой URL — Bitrix24 "устанавливает" серверное приложение
  const url = new URL(request.url);
  if (request.method === 'POST' && (url.pathname === '/' || url.pathname === '')) {
    // Получаем index.html через fetch самого себя (GET)
    const indexUrl = new URL('/', request.url);
    const indexRes = await fetch(indexUrl.toString());
    return new Response(indexRes.body, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  }

  return next();
}
