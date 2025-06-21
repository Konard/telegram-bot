#!/usr/bin/env node

// telegram-message-members.mjs
//
// Usage:
// 1. Run: node telegram-message-members.mjs
//
// This script will prompt for your API credentials, chat username or ID, and sticker set name.
// It will fetch all members of the chat and send each a random sticker from the set via private message.

const { use } = eval(await fetch('https://unpkg.com/use-m/use.js').then(u => u.text()));

const telegram = await use('telegram');
const input = await use('readline-sync');
const dotenv = await use('dotenv');
dotenv.config();

const { TelegramClient, Api } = telegram;
const { StringSession } = telegram.sessions;

const apiId = process.env.TELEGRAM_API_ID || input.question('Enter your Telegram API ID: ');
const apiHash = process.env.TELEGRAM_API_HASH || input.question('Enter your Telegram API Hash: ');
const stringSession = new StringSession(process.env.TELEGRAM_STRING_SESSION || '');

try {
  const client = new TelegramClient(stringSession, parseInt(apiId), apiHash, { connectionRetries: 5 });
  await client.start({
    phoneNumber: async () => process.env.TELEGRAM_PHONE || input.question('Enter your phone number: '),
    password: async () => input.question('Enter your 2FA password: '),
    phoneCode: async () => input.question('Enter the code you received: '),
    onError: (err) => console.error(err),
  });
  console.log('Connected.');

  let chat = process.env.TELEGRAM_CHAT_USERNAME || process.env.TELEGRAM_CHAT_ID;
  if (!chat) {
    chat = input.question('Enter chat username (with @) or chat ID: ');
  }
  chat = chat.replace(/[^\w@-]/g, '');
  const channel = await client.getEntity(chat);

  // Fetch all participants
  const participants = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const res = await client.invoke(new Api.channels.GetParticipants({
      channel: channel,
      filter: new Api.ChannelParticipantsRecent(),
      offset: offset,
      limit: limit,
      hash: 0,
    }));
    if (!res.users || res.users.length === 0) break;
    participants.push(...res.users);
    offset += res.users.length;
  }
  console.log(`Fetched ${participants.length} participants.`);

  // Search for "hello" and "hi" sticker sets and gather all stickers
  const searchHello = await client.invoke(new Api.messages.SearchStickerSets({
    q: 'hello',
    hash: 0,
    excludeFeatured: true,
  }));
  const searchHi = await client.invoke(new Api.messages.SearchStickerSets({
    q: 'hi',
    hash: 0,
    excludeFeatured: true,
  }));
  const coveredSets = [...searchHello.sets, ...searchHi.sets];
  if (!coveredSets.length) {
    console.error('No hello/hi sticker sets found');
    process.exit(1);
  }
  const docs = [];
  for (const covered of coveredSets) {
    const name = covered.set.shortName;
    try {
      const detail = await client.invoke(new Api.messages.GetStickerSet({
        stickerset: new Api.InputStickerSetShortName({ shortName: name }),
        hash: 0,
      }));
      docs.push(...detail.documents);
    } catch (err) {
      console.error(`Failed to fetch sticker set ${name}:`, err);
    }
  }
  if (!docs.length) {
    console.error('No stickers found in hello/hi sticker sets');
    process.exit(1);
  }
  const getRandomDoc = () => docs[Math.floor(Math.random() * docs.length)];

  // Ask for max greetings per run (0 = no limit)
  const maxGreetingsInput = process.env.TELEGRAM_MAX_GREETINGS || input.question('Enter max greetings to send (0 for no limit): ');
  let maxGreetings = parseInt(maxGreetingsInput, 10);
  if (isNaN(maxGreetings) || maxGreetings < 0) {
    maxGreetings = 0;
  }
  let sentCount = 0;

  // Send a random sticker to each participant
  for (const user of participants) {
    try {
      const peer = await client.getEntity(user.id);
      // Check last message in private chat
      let lastMsg;
      for await (const m of client.iterMessages(peer, { limit: 1 })) {
        lastMsg = m;
        break;
      }
      let canGreet = false;
      if (!lastMsg) {
        canGreet = true;
      } else {
        const lastDate = lastMsg.date instanceof Date ? lastMsg.date : new Date(lastMsg.date);
        if (Date.now() - lastDate.getTime() > 24 * 60 * 60 * 1000) {
          canGreet = true;
        }
      }
      if (!canGreet) {
        console.log(`Skipping ${user.username || user.id} – recently messaged within 24h.`);
        continue;
      }
      const doc = getRandomDoc();
      const media = new Api.InputMediaDocument({
        id: doc.id,
        accessHash: doc.accessHash,
        fileReference: doc.fileReference,
        ttlSeconds: 0,
      });
      const randomId = BigInt(Date.now() * 1000 + Math.floor(Math.random() * 1000));
      await client.invoke(new Api.messages.SendMedia({
        peer: peer,
        media: media,
        randomId: randomId,
        message: '',
      }));
      console.log(`Sent to ${user.username || user.id}`);
      // Pause for 30 seconds to avoid flooding
      console.log('Sleeping for 30 seconds before next greeting...');
      await new Promise(res => setTimeout(res, 30000));
      sentCount++;
      // Stop if max greetings reached
      if (maxGreetings > 0 && sentCount >= maxGreetings) {
        console.log('Reached max greetings limit.');
        break;
      }
    } catch (err) {
      console.error(`Failed to send to ${user.id}:`, err);
      await client.disconnect();
      process.exit(1);
    }
  }

  await client.disconnect();
  process.exit(0);
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
} 