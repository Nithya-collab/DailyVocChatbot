"""
Combined small web server and bot helper for installable app flow.

- /install -> redirects user to Discord OAuth2 to grant app install permissions
- /auth/callback -> exchanges code, lists user's guilds
- /setup/<guild_id> -> lets admin pick a channel and creates a webhook
- /interactions -> Interaction endpoint (verifies signature)

This file is a minimal example for development. In production use a proper webserver and HTTPS.
"""
import os
import requests
from flask import Flask, request, redirect, url_for, jsonify
from storage import save_guild_webhook, load_config
from dotenv import load_dotenv
from nacl.signing import VerifyKey
from nacl.exceptions import BadSignatureError

load_dotenv()

CLIENT_ID = os.getenv("DISCORD_CLIENT_ID")
CLIENT_SECRET = os.getenv("DISCORD_CLIENT_SECRET")
REDIRECT_URI = os.getenv("OAUTH_REDIRECT", "http://localhost:5000/auth/callback")
BOT_TOKEN = os.getenv("DISCORD_TOKEN")
PUBLIC_KEY = os.getenv("DISCORD_PUBLIC_KEY")

app = Flask(__name__)


@app.route("/install")
def install():
    # requests the user-level install scope
    scope = "identify guilds applications.commands.install"
    oauth = (
        "https://discord.com/api/oauth2/authorize"
        f"?client_id={CLIENT_ID}&redirect_uri={REDIRECT_URI}&response_type=code&scope={scope}"
    )
    return redirect(oauth)


@app.route("/auth/callback")
def callback():
    code = request.args.get("code")
    if not code:
        return "missing code", 400

    data = {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": REDIRECT_URI,
    }
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    r = requests.post("https://discord.com/api/oauth2/token", data=data, headers=headers)
    if r.status_code != 200:
        return f"token error: {r.text}", 400

    token = r.json().get("access_token")
    # list guilds the user is in
    g = requests.get("https://discord.com/api/users/@me/guilds", headers={"Authorization": f"Bearer {token}"})
    if g.status_code != 200:
        return f"guilds error: {g.text}", 400

    guilds = g.json()
    # return a simple JSON list for the user to pick from (client should redirect to /setup)
    return jsonify(guilds)


@app.route("/setup/<guild_id>", methods=["GET", "POST"])
def setup(guild_id):
    if request.method == "GET":
        # list channels for the guild so admin can pick channel_id
        url = f"https://discord.com/api/guilds/{guild_id}/channels"
        r = requests.get(url, headers={"Authorization": f"Bot {BOT_TOKEN}"})
        if r.status_code != 200:
            return f"failed to list channels: {r.text}", 400
        return jsonify(r.json())

    # POST with form/json {channel_id: "..."}
    data = request.get_json() or request.form
    channel_id = data.get("channel_id")
    if not channel_id:
        return "missing channel_id", 400

    # create webhook in channel
    url = f"https://discord.com/api/channels/{channel_id}/webhooks"
    r = requests.post(url, json={"name": "DailyVocBot"}, headers={"Authorization": f"Bot {BOT_TOKEN}"})
    if r.status_code != 200 and r.status_code != 201:
        return f"failed to create webhook: {r.text}", 400

    res = r.json()
    # build webhook url: https://discord.com/api/webhooks/{id}/{token}
    webhook_url = f"https://discord.com/api/webhooks/{res['id']}/{res['token']}"
    save_guild_webhook(guild_id, channel_id, webhook_url)
    return jsonify({"webhook": webhook_url})


def verify_signature(req):
    signature = req.headers.get("X-Signature-Ed25519", "")
    timestamp = req.headers.get("X-Signature-Timestamp", "")
    body = req.get_data().decode()
    try:
        key = VerifyKey(bytes.fromhex(PUBLIC_KEY))
        key.verify((timestamp + body).encode(), bytes.fromhex(signature))
        return True
    except Exception as e:
        print("signature verify failed:", e)
        return False


@app.route("/interactions", methods=["POST"])
def interactions():
    # verify request signature
    if not PUBLIC_KEY:
        return "Missing PUBLIC_KEY on server", 500

    if not verify_signature(request):
        return "bad signature", 401

    payload = request.json
    # handle PING
    if payload.get("type") == 1:
        return {"type": 1}

    # For application command interactions, you can handle them here
    # This minimal example returns a simple acknowledgement
    return {"type": 4, "data": {"content": "Thanks — your command was received."}}


if __name__ == "__main__":
    # Start Flask app. In production use a real WSGI server and HTTPS
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)))
