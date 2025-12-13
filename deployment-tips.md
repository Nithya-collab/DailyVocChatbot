I think these tips are created by vscode copilot agent mode

Discloud deployment
-------------------

Quick steps to host this bot 24x7 on Discloud:

1. Prepare project
   - Ensure `requirements.txt` is present (already added).
   - Make sure your bot entrypoint is `responsibility.py` (this project uses it).

2. Environment variables
   - Do NOT upload your `.env` with private tokens publicly.
   - In Discloud dashboard set these env vars:
     - `DISCORD_TOKEN` → your Discord bot token
     - `WEBHOOK_URL` → webhook URL (if used)
     - (Optional) `VOCAB_API_URL` → remote vocab API

3. Upload / Deploy on Discloud
   - Zip the repository (exclude local secrets) or push to a GitHub repo.
   - In Discloud create a new application and upload the zip or link GitHub.
   - Set the start command to: `python3 responsibility.py` (or choose `worker` if using Procfile).
   - Set the environment variables in Discloud's settings.
   - Enable the Keep-Online / 24x7 option in Discloud (if available for your plan).

4. Test locally (before deploy)
   ```bash
   python3 -m venv .venv
   . .venv/bin/activate
   pip install -r requirements.txt
   # create a local .env with DISCORD_TOKEN and WEBHOOK_URL for testing
   python3 responsibility.py
   ```

Notes
- The bot uses `discord.py`, `apscheduler`, `requests`, `python-dotenv`, and `pytz`.
- If you want the simple scheduled webhook sender instead, run `python3 nithiBot.py`.