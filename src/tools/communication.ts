/**
 * Notifies a Discord webhook or generic webhook.
 */
export async function sendNotification({ message }: { message: string }): Promise<string> {
  const webhookUrl = process.env.NOTIFICATION_WEBHOOK_URL;

  if (!webhookUrl) {
    return `Notification NOT sent: ${message} (NOTIFICATION_WEBHOOK_URL not set)`;
  }

  if (!message?.trim()) {
    throw new Error('send_notification requires a message');
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: message, // Discord format
        text: message     // Generic format
      })
    });

    if (!response.ok) {
      return `Failed to send notification: ${response.statusText}`;
    }

    return `Notification sent successfully: ${message}`;
  } catch (error) {
    return `Error sending notification: ${error instanceof Error ? error.message : String(error)}`;
  }
}
