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

// Fetch all stickers from found sets, with set metadata
const docs = [];
for (const setCover of sets) {
  const setName = setCover.set.shortName;
  const setTitle = setCover.set.title;
  try {
    const detail = await client.invoke(new Api.messages.GetStickerSet({
      stickerset: new Api.InputStickerSetShortName({ shortName: setName }),
      hash: 0,
    }));
    for (const docItem of detail.documents) {
      docs.push({ doc: docItem, setName, setTitle });
    }
  } catch (err) {
    console.error(`Failed to fetch sticker set ${setName}:`, err);
  }
}
if (!docs.length) {
  console.error('No stickers found in fetched sets.');
  process.exit(1);
}

// Filter for hi/hello stickers based on set metadata or alt text
const filtered = docs.filter(({ doc, setName, setTitle }) => {
  // match on set name or title
  if (/hi|hello/i.test(setName + ' ' + setTitle)) return true;
  // inspect the sticker's alt text
  const attributes = doc.document ? doc.document.attributes : doc.attributes;
  const stickerAttr = attributes.find(a => a.className === 'DocumentAttributeSticker');
  if (!stickerAttr?.alt) return false;
  return /hi|hello|👋/i.test(stickerAttr.alt);
});
if (!filtered.length) {
  console.error('No hi/hello stickers found after filtering.');
  process.exit(1);
}

// Pick a random hi/hello sticker and send it
const { doc } = filtered[Math.floor(Math.random() * filtered.length)];
// Some Document objects nest the real fields under `doc.document`
const docRaw = doc.document ? doc.document : doc;
// Unwrap Integer-like types to BigInt
const idRaw = docRaw.id;
const accessHashRaw = docRaw.accessHash;
const fileReference = docRaw.fileReference;
const id = typeof idRaw === 'object' && 'value' in idRaw ? idRaw.value : idRaw;
const accessHash = typeof accessHashRaw === 'object' && 'value' in accessHashRaw ? accessHashRaw.value : accessHashRaw;
if (id === undefined || accessHash === undefined || fileReference === undefined) {
  console.error('Failed to extract id/accessHash/fileReference from doc:', doc);
  process.exit(1);
}

// Wrap the sticker into the InputDocument type for sending
const inputDoc = new Api.InputDocument({ id, accessHash, fileReference });
// Create the media payload with InputDocument as 'id'
const media = new Api.InputMediaDocument({ id: inputDoc, ttlSeconds: 0 });
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