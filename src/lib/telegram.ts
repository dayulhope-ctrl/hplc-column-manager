const TOKEN   = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

/**
 * 텔레그램 메시지 발송
 * 환경변수(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)가 없으면 조용히 스킵
 */
export async function sendTelegramMessage(text: string): Promise<void> {
  if (!TOKEN || !CHAT_ID) return;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML' }),
      }
    );
    if (!res.ok) {
      const err = await res.json();
      console.error('Telegram API error:', err);
    }
  } catch (e) {
    // 알림 실패해도 요청 처리는 계속됨
    console.error('Telegram notification failed:', e);
  }
}
