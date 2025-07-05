#!/usr/bin/env node
import fs from 'fs';

export async function initTelegramConnection() {
  const { use } = eval(await fetch('https://unpkg.com/use-m/use.js').then(u => u.text()));
  const telegram = await use('telegram');
  const input = await use('readline-sync');
  const dotenv = await use('dotenv');
  dotenv.config();

  // Exit immediately on any unhandled rejections or uncaught exceptions
  process.on('unhandledRejection', err => {
    console.error('Unhandled Rejection:', err);
    process.exit(1);
  });
  process.on('uncaughtException', err => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
  });

  const { TelegramClient } = telegram;
  const { StringSession } = telegram.sessions;

  // Read API credentials
  const apiId = process.env.TELEGRAM_API_ID || input.question('Enter your Telegram API ID: ');
  const apiHash = process.env.TELEGRAM_API_HASH || input.question('Enter your Telegram API Hash: ');

  // Load or create session from absolute file path
  const sessionFile = '/Users/konard/Code/konard/telegram-bot/.telegram_session';
  const fileExists = fs.existsSync(sessionFile);
  let storedSession = '';
  if (fileExists) {
    try {
      storedSession = (await fs.promises.readFile(sessionFile, 'utf8')).trim();
    } catch (err) {
      console.error('Error reading session file:', err);
      process.exit(1);
    }
  }
  const stringSession = new StringSession(storedSession);
  const client = new TelegramClient(stringSession, parseInt(apiId, 10), apiHash, { connectionRetries: 5 });

  // Start and authorize if needed
  await client.start({
    phoneNumber: async () => process.env.TELEGRAM_PHONE || input.question('Enter your phone number: '),
    password: async () => input.question('Enter your 2FA password (if any): '),
    phoneCode: async () => input.question('Enter the code you received: '),
    onError: err => console.error(err),
  });
  console.log('Connected.');

  // Save new session after first run
  if (!fileExists) {
    try {
      await fs.promises.writeFile(sessionFile, client.session.save(), 'utf8');
      console.log(`Saved session to ${sessionFile}`);
    } catch (err) {
      console.error('Error writing session file:', err);
      process.exit(1);
    }
  }

  return client;
}

if (import.meta.main) {
  const client = await initTelegramConnection();

  // Send /start command to the bot
  await client.sendMessage('@DeepGPTBot', { message: '/start' });
  console.log('Sent /start message to @DeepGPTBot');

  await client.disconnect();
  process.exit(0);
} 