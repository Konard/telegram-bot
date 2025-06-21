#!/usr/bin/env node

// send-sticker.mjs
//
// Usage:
//   node send-sticker.mjs
//
// This script will prompt for your API credentials (or use environment variables), connect to Telegram,
// search for "hi" sticker sets, pick a random sticker, and send it to the public chat @The_Jacque_Fresco.

const { use } = eval(await fetch('https://unpkg.com/use-m/use.js').then(u => u.text()));
const telegram = await use('telegram');
const input = await use('readline-sync');
const dotenv = await use('dotenv');
dotenv.config();

const { TelegramClient, Api } = telegram;
const { StringSession } = telegram.sessions;

const apiId = process.env.TELEGRAM_API_ID || input.question('Enter your Telegram API ID: ');
const apiHash = process.env.TELEGRAM_API_HASH || input.question('Enter your Telegram API Hash: ');
const stringSession = new StringSession('');
const client = new TelegramClient(stringSession, parseInt(apiId), apiHash, { connectionRetries: 5 });

await client.start({
  phoneNumber: async () => process.env.TELEGRAM_PHONE || input.question('Enter your phone number: '),
  password: async () => input.question('Enter your 2FA password (if any): '),
  phoneCode: async () => input.question('Enter the code you received: '),
  onError: err => console.error(err),
});
console.log('Connected.');

// Define target chat
const chatUsername = '@The_Jacque_Fresco';
const channel = await client.getEntity(chatUsername);

console.log('Searching sticker sets for "hi"...');
const searchResult = await client.invoke(new Api.messages.SearchStickerSets({ q: 'hi', excludeFeatured: true, hash: 0 }));
const sets = searchResult.sets;
if (!sets.length) {
  console.error('No sticker sets found for "hi".');
  process.exit(1);
}

// Fetch all stickers from found sets
const docs = [];
for (const set of sets) {
  try {
    const detail = await client.invoke(new Api.messages.GetStickerSet({
      stickerset: new Api.InputStickerSetShortName({ shortName: set.set.shortName }),
      hash: 0,
    }));
    docs.push(...detail.documents);
  } catch (err) {
    console.error(`Failed to fetch sticker set ${set.set.shortName}:`, err);
  }
}
if (!docs.length) {
  console.error('No stickers found in fetched sets.');
  process.exit(1);
}

// Pick a random sticker and send it
const doc = docs[Math.floor(Math.random() * docs.length)];
const media = new Api.InputMediaDocument({
  id: doc.id,
  accessHash: doc.accessHash,
  fileReference: doc.fileReference,
  ttlSeconds: 0,
});
const randomId = BigInt(Date.now() * 1000 + Math.floor(Math.random() * 1000));

await client.invoke(new Api.messages.SendMedia({
  peer: channel,
  media: media,
  randomId: randomId,
  message: '',
}));
console.log('Sticker sent!');

await client.disconnect();
process.exit(0); 