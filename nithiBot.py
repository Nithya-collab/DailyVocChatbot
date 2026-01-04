import requests
from apscheduler.schedulers.blocking import BlockingScheduler
from datetime import datetime
import pytz

import os
from dotenv import load_dotenv

load_dotenv()

WEBHOOK_URL = os.getenv("WEBHOOK_URL")

TIMEZONE = pytz.timezone("Asia/Kolkata")

def sendDiscordAlarm():
     now = datetime.now(TIMEZONE).strftime("%d-%m-%Y %H:%M:%S")
     message = "Daily alarm! join NithiBot now!"
     data = {
          "content":message
     }

     response = requests.post(WEBHOOK_URL, json=data)

    #  requests.post(WEBHOOK_URL, json={"content": "Test message"})


     print(f"response : {response.text}")
     print(f"message sent at {now}, response code: {response.status_code}")


schedular = BlockingScheduler(timezone=TIMEZONE)
# schedular.add_job(sendDiscordAlarm, 'cron', seconds=10)
schedular.add_job(sendDiscordAlarm, 'cron', hour=20,minute=45)
# schedular.add_job(sendDiscordAlarm, 'cron', hour=14,minute=0)
# schedular.add_job(sendDiscordAlarm, 'cron', hour=18,minute=13)


print('Schedular started !')
schedular.start()


# import requests

# WEBHOOK_URL = "https://discord.com/api/webhooks/1446148137268940936/aoe-gQhfHpDzujq2G-KJo-_IkzWBPWzdODdOdduiG0NdmiEeFdMh1BQngeM4lUyri83b"

# requests.post(WEBHOOK_URL, json={"content": "Test message from Python!"})
