import os
import subprocess
import sys

from rich.console import Console

from .config import get_token, read_config

console = Console()


def run_claude(args: list[str]) -> None:
    """Implementation for `relay claude` command."""
    config = read_config()
    if not config:
        console.print("[red]Error:[/red] Not configured. Run [bold]relay setup[/bold] first.")
        sys.exit(1)

    token = get_token(config.device_uuid)
    if not token:
        console.print("[red]Error:[/red] No token found. Run [bold]relay setup[/bold] again.")
        sys.exit(1)

    env = os.environ.copy()
    env["ANTHROPIC_BASE_URL"] = config.server_url.rstrip('/')
    env["ANTHROPIC_AUTH_TOKEN"] = token
    env["CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY"] = "1"

    try:
        result = subprocess.run(
            ["claude"] + args,
            env=env,
            check=False
        )
        sys.exit(result.returncode)
    except FileNotFoundError:
        console.print("[red]Error:[/red] 'claude' command not found. Install Claude Code first.")
        sys.exit(1)
    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")
        sys.exit(1)