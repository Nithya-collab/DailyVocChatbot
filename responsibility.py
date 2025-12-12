import discord
from discord.ext import commands
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime, timedelta
import pytz
import requests
from dotenv import load_dotenv
import os

load_dotenv()


TOKEN = os.getenv("DISCORD_TOKEN")
WEBHOOK_URL = os.getenv("WEBHOOK_URL")


TIMEZONE = pytz.timezone("Asia/Kolkata")
scheduler = AsyncIOScheduler(timezone=TIMEZONE)

intents = discord.Intents.default()
intents.message_content = True

bot = commands.Bot(command_prefix="!", intents=intents)


def send_reminder(text):
    requests.post(WEBHOOK_URL, json={"content": f"⏰ Reminder: {text}"})
    print("Sent:", text)


@bot.event
async def on_ready():
    print("Bot is online!")
    scheduler.start()


# @bot.command()
# async def remind(ctx, time: str, *, text: str):
#     print("Command trigger working")   # DEBUG
#     try:
#         now = datetime.now(TIMEZONE)
#         hour, minute = map(int, time.split(":"))
#         remind_time = now.replace(hour=hour, minute=minute, second=0, microsecond=0)

#         if remind_time < now:
#             remind_time += timedelta(days=1)

#         scheduler.add_job(send_reminder, "date", run_date=remind_time, args=[text])

#         await ctx.send(
#             f"⏳ Reminder set for **{remind_time.strftime('%H:%M')}** → {text}"
#         )

#     except Exception as e:
#         await ctx.send(f"⚠️ Error: {e}")

@bot.command()
async def remind(ctx, date: str, time: str, *, text: str):
    """
    Example:
    !remind 2025-12-11 22:10 Drink water
    """
    try:
        # Combine date + time
        remind_str = f"{date} {time}"

        # Convert to datetime object
        remind_time = datetime.strptime(remind_str, "%Y-%m-%d %H:%M")

        # Add timezone
        remind_time = TIMEZONE.localize(remind_time)

        now = datetime.now(TIMEZONE)

        # If reminder is in the past
        if remind_time < now:
            await ctx.send("❌ That time already passed!")
            return

        # Schedule the job
        scheduler.add_job(send_reminder, "date", run_date=remind_time, args=[text])

        await ctx.send(f"⏳ Reminder set for **{remind_time}** → {text}")
        print("Scheduled:", remind_time, text)

    except Exception as e:
        await ctx.send(f"⚠️ Error: {e}")
        print("Error:", e)


bot.run(TOKEN)
