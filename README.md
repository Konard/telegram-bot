# telegram-bot
Scripts to work with telegram

## How to Get Your Telegram API ID and API Hash

1. Go to [https://my.telegram.org](https://my.telegram.org) and log in with your Telegram phone number.
2. Click on **API development tools**.
3. Fill in the required fields:
   - **App title**: Any name you like (e.g., MyApp).
   - **Short name**: Any short identifier (e.g., myapp).
   - **URL**: You can use any valid URL (e.g., https://example.com).
4. Click **Create application**.
5. After creation, you will see your **API ID** and **API Hash** displayed on the page.
6. Copy these values. You can either:
   - Create a `.env` file in this directory with:
     ```
     TELEGRAM_API_ID=your_api_id
     TELEGRAM_API_HASH=your_api_hash
     ```
   - Or, enter them manually when prompted by the script.

## Usage

1. Run the script:
   ```
   node telegram-history-to-markdown.mjs
   ```
2. Follow the prompts to log in and select the chat.
3. The chat history will be saved as `chat-history.md` in this directory.
