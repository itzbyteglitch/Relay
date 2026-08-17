import uuid

import click
import httpx
from rich.console import Console
from rich.panel import Panel

from .config import read_config, set_token, write_config, Config

console = Console()


def run_setup(server_url: str, password: str, device_name: str) -> None:
    """Implementation for `relay setup` command."""
    if not server_url.startswith(('http://', 'https://')):
        console.print("[red]Error:[/red] Server URL must start with http:// or https://")
        sys.exit(1)

    device_uuid = str(uuid.uuid4())

    console.print(Panel.fit(f"Registering device [cyan]{device_name}[/cyan] ([dim]{device_uuid}[/dim])", title="Relay Setup"))

    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(
                f"{server_url.rstrip('/')}/auth/register",
                json={
                    "password": password,
                    "device_name": device_name,
                    "device_uuid": device_uuid
                }
            )
            if response.status_code == 401:
                console.print("[red]Error:[/red] Invalid password")
                sys.exit(1)
            elif response.status_code == 409:
                console.print("[red]Error:[/red] Device already registered")
                sys.exit(1)
            elif response.status_code == 429:
                console.print("[red]Error:[/red] Rate limited. Try again later.")
                sys.exit(1)
            elif response.status_code != 200:
                console.print(f"[red]Error:[/red] Server returned {response.status_code}: {response.text}")
                sys.exit(1)

            data = response.json()
            token = data.get("token")
            if not token:
                console.print("[red]Error:[/red] No token in response")
                sys.exit(1)

            write_config(Config(
                server_url=server_url,
                device_uuid=device_uuid,
                device_name=device_name
            ))
            set_token(device_uuid, token)

    except httpx.ConnectError:
        console.print(f"[red]Error:[/red] Could not connect to {server_url}")
        sys.exit(1)
    except httpx.TimeoutException:
        console.print("[red]Error:[/red] Connection timed out")
        sys.exit(1)
    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")
        sys.exit(1)

    console.print(Panel.fit(
        f"[green]Success![/green] Device registered as [cyan]{device_name}[/cyan]\n"
        f"Token stored securely in keychain.\n\n"
        f"Next step: run [bold]relay claude[/bold] to launch Claude Code.",
        title="Setup Complete"
    ))


def prompt_server_url() -> str:
    return click.prompt("Server URL", type=str)


def prompt_password() -> str:
    return click.prompt("Password", type=str, hide_input=True)


def prompt_device_name() -> str:
    return click.prompt("Device name", type=str)


import sys