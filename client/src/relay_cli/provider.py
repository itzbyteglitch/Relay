import click
import httpx
from rich.console import Console
from rich.table import Table

from .config import read_config

console = Console()


def get_admin_token(admin_password: str, server_url: str) -> str:
    """Get admin token by authenticating with admin password."""
    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(
                f"{server_url.rstrip('/')}/admin/auth/admin-token",
                json={"password": admin_password}
            )
            if response.status_code == 401:
                console.print("[red]Error:[/red] Invalid admin password")
                raise click.Abort()
            elif response.status_code != 200:
                console.print(f"[red]Error:[/red] Server returned {response.status_code}: {response.text}")
                raise click.Abort()

            data = response.json()
            return data.get("token", "")
    except httpx.ConnectError:
        console.print(f"[red]Error:[/red] Could not connect to {server_url}")
        raise click.Abort()
    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")
        raise click.Abort()


def provider_add(name: str, key: str, admin_password: str) -> None:
    """Implementation for `relay provider add` command."""
    config = read_config()
    if not config:
        console.print("[red]Error:[/red] Not configured. Run [bold]relay setup[/bold] first.")
        raise click.Abort()

    admin_token = get_admin_token(admin_password, config.server_url)

    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(
                f"{config.server_url.rstrip('/')}/admin/provider",
                headers={"Authorization": f"Bearer {admin_token}"},
                json={"name": name, "key": key}
            )
            if response.status_code == 401:
                console.print("[red]Error:[/red] Invalid admin token")
                raise click.Abort()
            elif response.status_code != 200:
                console.print(f"[red]Error:[/red] Server returned {response.status_code}: {response.text}")
                raise click.Abort()

            console.print(f"[green]Success![/green] Provider [cyan]{name}[/cyan] added.")
    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")
        raise click.Abort()


def provider_add_custom(name: str, base_url: str, key: str, schema: str, admin_password: str) -> None:
    """Implementation for `relay provider add custom` command."""
    config = read_config()
    if not config:
        console.print("[red]Error:[/red] Not configured. Run [bold]relay setup[/bold] first.")
        raise click.Abort()

    admin_token = get_admin_token(admin_password, config.server_url)

    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(
                f"{config.server_url.rstrip('/')}/admin/provider",
                headers={"Authorization": f"Bearer {admin_token}"},
                json={
                    "name": name,
                    "transport": schema,
                    "base_url": base_url,
                    "key": key,
                    "model_prefix": f"{name}/",
                    "enabled": True
                }
            )
            if response.status_code == 401:
                console.print("[red]Error:[/red] Invalid admin token")
                raise click.Abort()
            elif response.status_code != 200:
                console.print(f"[red]Error:[/red] Server returned {response.status_code}: {response.text}")
                raise click.Abort()

            console.print(f"[green]Success![/green] Custom provider [cyan]{name}[/cyan] added.")
    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")
        raise click.Abort()


def provider_list(admin_password: str) -> None:
    """Implementation for `relay provider list` command."""
    config = read_config()
    if not config:
        console.print("[red]Error:[/red] Not configured. Run [bold]relay setup[/bold] first.")
        raise click.Abort()

    admin_token = get_admin_token(admin_password, config.server_url)

    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.get(
                f"{config.server_url.rstrip('/')}/admin/provider",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            if response.status_code == 401:
                console.print("[red]Error:[/red] Invalid admin token")
                raise click.Abort()
            elif response.status_code != 200:
                console.print(f"[red]Error:[/red] Server returned {response.status_code}: {response.text}")
                raise click.Abort()

            data = response.json()
            providers = data.get("providers", [])

            if not providers:
                console.print("No providers configured.")
                return

            table = Table(title="Configured Providers")
            table.add_column("Name", style="cyan")
            table.add_column("Transport", style="magenta")
            table.add_column("Base URL", style="blue")
            table.add_column("Model Prefix", style="green")
            table.add_column("Enabled", style="yellow")
            table.add_column("Key", style="dim")

            for p in providers:
                table.add_row(
                    p["name"],
                    p["transport"],
                    p["base_url"],
                    p["model_prefix"],
                    "✓" if p["enabled"] else "✗",
                    p["key"]
                )

            console.print(table)
    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")
        raise click.Abort()


def provider_remove(name: str, admin_password: str) -> None:
    """Implementation for `relay provider remove` command."""
    config = read_config()
    if not config:
        console.print("[red]Error:[/red] Not configured. Run [bold]relay setup[/bold] first.")
        raise click.Abort()

    admin_token = get_admin_token(admin_password, config.server_url)

    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.delete(
                f"{config.server_url.rstrip('/')}/admin/provider/{name}",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            if response.status_code == 401:
                console.print("[red]Error:[/red] Invalid admin token")
                raise click.Abort()
            elif response.status_code != 200:
                console.print(f"[red]Error:[/red] Server returned {response.status_code}: {response.text}")
                raise click.Abort()

            console.print(f"[green]Success![/green] Provider [cyan]{name}[/cyan] removed.")
    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")
        raise click.Abort()