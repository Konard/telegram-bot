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
    // Pre-flight check: ensure the entity is a channel, not a user
    try {
      await client.invoke(new Api.channels.GetParticipants({ channel, filter: new Api.ChannelParticipantsRecent(), offset: 0, limit: 1, hash: 0 }));
    } catch (err) {
      if (err.message.includes('InputPeerUser')) {
        throw new Error(`Failed to fetch members: the identifier "${chat}" refers to a user, not a channel. Please provide a group or supergroup chat username or ID.`);
      }
      throw err;
    }

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
    // Exclude the bot itself from recipients
    const me = await client.getMe();
    const myId = typeof me.id === 'object' && 'value' in me.id ? me.id.value : me.id;
    const recipients = participants.filter(user => {
      const uid = typeof user.id === 'object' && 'value' in user.id ? user.id.value : user.id;
      return uid !== myId;
    });
    console.log(`Excluding self (id=${myId}), will message ${recipients.length} participants.`);
    if (!recipients.length) {
      console.log('No other participants to message.');
      return;
    }


    // Determine max greetings: command-line arg overrides env and prompt (0 for no limit)
    const maxGreetingsArg = process.argv[2];
    const maxGreetingsInput = maxGreetingsArg !== undefined
      ? maxGreetingsArg
      : (process.env.TELEGRAM_MAX_GREETINGS || input.question('Enter max greetings to send (0 for no limit): '));
    let maxGreetings = parseInt(maxGreetingsInput, 10);
    if (isNaN(maxGreetings) || maxGreetings < 0) {
      maxGreetings = 0;
    }
    let sentCount = 0;

    // Send a random hi/hello sticker using shared function
    for (const user of recipients) {
      try {
        const peer = await client.getEntity(user.id);
        // Check last message in private chat
        let lastMsg;
        for await (const m of client.iterMessages(peer, { limit: 1 })) {
          lastMsg = m;
          break;
        }
        // Trace last message data
        if (lastMsg) {
          const lastDate = lastMsg.date instanceof Date ? lastMsg.date : new Date(lastMsg.date);
          console.log(`Last interaction with ${user.username || user.id}: "${lastMsg.message || lastMsg.text}" at ${lastDate.toISOString()}`);
        } else {
          console.log(`No prior interaction with ${user.username || user.id}`);
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
        const { index } = await sendGreetingSticker({ client, Api, chatUsername: chatTarget });
        console.log(`Sticker #${index} sent to ${user.username || user.id}`);

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