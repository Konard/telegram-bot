#!/usr/bin/env node
import { usingTelegram, use } from './utils.mjs';
import { sendGreetingSticker } from './send-greeting-sticker.mjs';

// telegram-message-members.mjs
//
// Usage:
// 1. Run: node telegram-message-members.mjs
//
// This script will prompt for your API credentials, chat username or ID, and sticker set name.
// It will fetch all members of the chat and send each a random sticker from the set via private message.

const input = await use('readline-sync');

try {
  await usingTelegram(async ({ client, Api }) => {
    // Connected.

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


    // Ask for max greetings per run (0 = no limit)
    const maxGreetingsInput = process.env.TELEGRAM_MAX_GREETINGS || input.question('Enter max greetings to send (0 for no limit): ');
    let maxGreetings = parseInt(maxGreetingsInput, 10);
    if (isNaN(maxGreetings) || maxGreetings < 0) {
      maxGreetings = 0;
    }
    let sentCount = 0;

    // Send a random hi/hello sticker using shared function
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
        const chatTarget = user.username ? `@${user.username}` : user.id;
        await sendGreetingSticker({ client, Api, chatUsername: chatTarget });

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
        throw err;
      }
    }

  });
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
} 