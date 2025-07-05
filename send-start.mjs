#!/usr/bin/env node
import { usingTelegram } from './utils.mjs';

if (import.meta.main) {
  await usingTelegram(async ({ client }) => {
    // Send /start command to the bot
    await client.sendMessage('@DeepGPTBot', { message: '/start' });
    console.log('Sent /start message to @DeepGPTBot');
  });
} 