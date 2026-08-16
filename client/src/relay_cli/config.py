import json
from dataclasses import asdict, dataclass
from pathlib import Path

import keyring
from rich.console import Console

from .crypto import decrypt_token, encrypt_token

console = Console()

CONFIG_DIR = Path.home() / '.relay'
CONFIG_FILE = CONFIG_DIR / 'config.json'


@dataclass
class Config:
    server_url: str
    device_uuid: str
    device_name: str
    encrypted_token: str | None = None


def read_config() -> Config | None:
    if not CONFIG_FILE.exists():
        return None
    try:
        with open(CONFIG_FILE) as f:
            data = json.load(f)
        return Config(**data)
    except Exception:
        return None


def write_config(config: Config) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_FILE, 'w') as f:
        json.dump(asdict(config), f, indent=2)


def get_token(device_uuid: str) -> str | None:
    """Get device token from keyring or fallback."""
    try:
        token = keyring.get_password("relay-cli", device_uuid)
        if token:
            return token
    except Exception:
        pass

    config = read_config()
    if config and config.device_uuid == device_uuid:
        encrypted = getattr(config, 'encrypted_token', None)
        if encrypted:
            try:
                return decrypt_token(encrypted, device_uuid)
            except Exception:
                pass

    return None


def set_token(device_uuid: str, token: str) -> None:
    """Store device token in keyring or fallback."""
    try:
        keyring.set_password("relay-cli", device_uuid, token)
        return
    except Exception as e:
        console.print(f"[yellow]Warning:[/yellow] Keyring unavailable ({e}), using fallback encryption")

    config = read_config()
    if config and config.device_uuid == device_uuid:
        encrypted = encrypt_token(token, device_uuid)
        config_dict = asdict(config)
        config_dict['encrypted_token'] = encrypted
        write_config(Config(**config_dict))


def delete_token(device_uuid: str) -> None:
    """Delete device token from keyring or fallback."""
    try:
        keyring.delete_password("relay-cli", device_uuid)
    except Exception:
        pass

    config = read_config()
    if config and config.device_uuid == device_uuid:
        config_dict = asdict(config)
        config_dict.pop('encrypted_token', None)
        write_config(Config(**config_dict))