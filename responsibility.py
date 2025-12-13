import discord
from discord.ext import commands
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime, timedelta
import pytz
import requests
from dotenv import load_dotenv
import os
import random
import json

load_dotenv()

# ------------------ CONFIG ------------------
TOKEN = os.getenv("DISCORD_TOKEN")
WEBHOOK_URL = os.getenv("WEBHOOK_URL")
VOCAB_API_URL = os.getenv("VOCAB_API_URL")  
VOCAB_JSON_FILE = "vocab.json"
TIMEZONE = pytz.timezone("Asia/Kolkata")


intents = discord.Intents.default()
intents.message_content = True
intents.members = True  # Guild Members Intent - enable in developer portal too
bot = commands.Bot(command_prefix="!", intents=intents)

scheduler = AsyncIOScheduler(timezone=TIMEZONE)

# Local JSON list
vocab_list = []
if not VOCAB_API_URL:
    try:
        with open(VOCAB_JSON_FILE, "r", encoding="utf-8") as f:
            vocab_list = json.load(f)
            print(f"Loaded {len(vocab_list)} words from {VOCAB_JSON_FILE}")
    except Exception as e:
        print("Error loading vocab.json:", e)



def fetch_vocab():
    try:
        # API mode → API returns array of words
        if VOCAB_API_URL:
            r = requests.get(VOCAB_API_URL)
            r.raise_for_status()
            api_data = r.json()

            if not isinstance(api_data, list):
                raise ValueError("API must return a list of vocab objects")

            if len(api_data) < 5:
                raise ValueError("API returned less than 5 words")

            selected = random.sample(api_data, 5)

        else:
            # Local JSON mode
            if len(vocab_list) < 5:
                raise ValueError("Not enough words in local vocab.json")

            selected = random.sample(vocab_list, 5)

        # Format message
        msg = ""
        for w in selected:
            msg += f"📚 **{w['word']}**\n📝 Meaning: **{w['meaning']}**\n\n"

        return msg.strip()

    except Exception as e:
        print("Error fetching vocab:", e)
        return None


def send_vocab_reminder():
    content = fetch_vocab()
    if not content:
        return

    # Legacy single webhook support
    if WEBHOOK_URL:
        try:
            requests.post(WEBHOOK_URL, json={"content": content})
            print("Sent today's vocabulary to legacy WEBHOOK_URL.")
        except Exception as e:
            print("Failed legacy webhook post:", e)

    # Per-guild webhooks stored in guild_config.json
    try:
        with open("guild_config.json", "r", encoding="utf-8") as f:
            cfg = json.load(f)
    except Exception:
        cfg = {}

    for gid, data in cfg.items():
        webhook = data.get("webhook")
        if not webhook:
            continue
        try:
            requests.post(webhook, json={"content": content})
            print(f"Sent vocab to guild {gid} webhook.")
        except Exception as e:
            print(f"Failed to send vocab to guild {gid}:", e)

def send_not_learn_warning():
    warning = "⚠️ You still not learn today's vocabulary!"

    # send to legacy webhook if present
    if WEBHOOK_URL:
        try:
            requests.post(WEBHOOK_URL, json={"content": warning})
            print("Sent not-learn warning to legacy WEBHOOK_URL.")
        except Exception as e:
            print("Failed legacy warning post:", e)

    # send to per-guild webhooks
    try:
        with open("guild_config.json", "r", encoding="utf-8") as f:
            cfg = json.load(f)
    except Exception:
        cfg = {}

    for gid, data in cfg.items():
        webhook = data.get("webhook")
        if not webhook:
            continue
        try:
            requests.post(webhook, json={"content": warning})
            print(f"Sent not-learn warning to guild {gid}.")
        except Exception as e:
            print(f"Failed warning for guild {gid}:", e)


@bot.event
async def on_ready():
    print(f"✅ Bot online as {bot.user}")

    # Daily vocab at 10:00 AM default app time
    scheduler.add_job(
        send_vocab_reminder,
        "cron",
        hour=10,
        minute=0
    )

    # use below set to test with custome time
#     scheduler.add_job(
#     send_vocab_reminder,
#     "date",
#     run_date=datetime.now(TIMEZONE).replace(hour=18, minute=45, second=0, microsecond=0)
# )

    print("📌 Daily vocab scheduled at 10:00 AM")

    if not scheduler.running:
        scheduler.start()
        print("⏳ Scheduler started.")



@bot.command()
async def remind(ctx, first: str, second: str = None):
    """
    Examples:
      !remind 15:15
      !remind 2025-01-20 10:00
    """

    try:
        now = datetime.now(TIMEZONE)

        # Full date + time
        if second and ":" in second:
            date_str = first
            time_str = second
            remind_time = datetime.strptime(
                f"{date_str} {time_str}", "%Y-%m-%d %H:%M"
            )
            remind_time = TIMEZONE.localize(remind_time)

        else:
            # Only time HH:MM
            hour, minute = map(int, first.split(":"))
            remind_time = now.replace(
                hour=hour, minute=minute, second=0, microsecond=0
            )

            if remind_time < now:
                remind_time += timedelta(days=1)

        scheduler.add_job(send_not_learn_warning, "date", run_date=remind_time)

        await ctx.send(
            f"⏳ Reminder set for **{remind_time.strftime('%Y-%m-%d %H:%M')}**"
        )
        print("Scheduled warning at:", remind_time)

    except Exception as e:
        print("Error:", e)
        await ctx.send(f"⚠️ Error: {e}")


bot.run(TOKEN)
