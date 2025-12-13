import json
from pathlib import Path

CONFIG_PATH = Path("guild_config.json")

def load_config():
    try:
        if CONFIG_PATH.exists():
            return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except Exception:
        pass
    return {}

def save_config(cfg: dict):
    CONFIG_PATH.write_text(json.dumps(cfg, indent=2), encoding="utf-8")

def save_guild_webhook(guild_id, channel_id, webhook_url):
    cfg = load_config()
    cfg[str(guild_id)] = {"channel_id": str(channel_id), "webhook": webhook_url}
    save_config(cfg)
