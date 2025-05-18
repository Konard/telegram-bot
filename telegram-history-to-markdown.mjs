// telegram-history-to-markdown.mjs
//
// Usage:
// 1. Just run: node telegram-history-to-markdown.mjs
//
// This script will prompt for your API credentials and the chat username or ID.
// It will save the chat history as Markdown in 'chat-history.md'.

const { use } = eval(
  await fetch('https://unpkg.com/use-m/use.js').then(u => u.text())
);

const telegram = await use('telegram');
const input = await use('readline-sync');
const fs = await use('fs');
const dotenv = await use('dotenv');
dotenv.config();

const { TelegramClient } = telegram;
const { StringSession } = telegram.sessions;

const apiId = process.env.TELEGRAM_API_ID || input.question('Enter your Telegram API ID: ');
const apiHash = process.env.TELEGRAM_API_HASH || input.question('Enter your Telegram API Hash: ');
const stringSession = new StringSession(''); // Empty string for new session

async function main() {
  const client = new TelegramClient(stringSession, parseInt(apiId), apiHash, {
    connectionRetries: 5,
  });
  await client.start({
    phoneNumber: async () => input.question('Enter your phone number: '),
    password: async () => input.question('Enter your 2FA password: '),
    phoneCode: async () => input.question('Enter the code you received: '),
    onError: (err) => console.log(err),
  });
  console.log('You are now connected.');

  const chat = input.question('Enter chat username (with @) or chat ID: ');
  const entity = await client.getEntity(chat);

  let allMessages = [];
  for await (const message of client.iterMessages(entity, { limit: 10000 })) {
    if (message.message) {
      allMessages.push({
        date: message.date.toISOString(),
        sender: message.senderId,
        text: message.message,
      });
    }
  }

  // Format as Markdown
  const md = allMessages
    .reverse()
    .map(
      (msg) => `**${msg.sender}** [${msg.date}]:\n${msg.text}\n`
    )
    .join('\n');

  fs.writeFileSync('chat-history.md', md);
  console.log('Chat history saved to chat-history.md');
  await client.disconnect();
}

main();
