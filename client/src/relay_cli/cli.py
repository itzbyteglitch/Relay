
import click

from .claude import run_claude
from .provider import provider_add, provider_add_custom, provider_list, provider_remove
from .setup import run_setup


@click.group()
@click.version_option()
def cli():
    """Relay - Proxy Claude Code through arbitrary LLM providers."""


@cli.command()
@click.option('--server-url', prompt='Server URL', help='Relay server URL (e.g., https://relay.yourdomain.workers.dev)')
@click.option('--password', prompt=True, hide_input=True, help='Device password')
@click.option('--device-name', prompt='Device name', help='Name for this device')
def setup(server_url, password, device_name):
    """Configure Relay server connection and register device."""
    run_setup(server_url, password, device_name)


@cli.command(context_settings=dict(ignore_unknown_options=True, allow_extra_args=True))
@click.pass_context
def claude(ctx):
    """Launch Claude Code with Relay configuration."""
    run_claude(ctx.args)


@cli.group()
def provider():
    """Manage LLM providers."""


@provider.command()
@click.argument('name')
@click.option('--key', prompt=True, hide_input=True, help='Provider API key')
@click.option('--admin-password', prompt=True, hide_input=True, help='Admin password')
def add(name, key, admin_password):
    """Add a provider from the catalog."""
    provider_add(name, key, admin_password)


@provider.command()
@click.argument('name')
@click.option('--base-url', prompt=True, help='Provider base URL')
@click.option('--key', prompt=True, hide_input=True, help='Provider API key')
@click.option('--schema', type=click.Choice(['openai', 'anthropic']), prompt=True, help='API schema')
@click.option('--admin-password', prompt=True, hide_input=True, help='Admin password')
def add_custom(name, base_url, key, schema, admin_password):
    """Add a custom provider."""
    provider_add_custom(name, base_url, key, schema, admin_password)


@provider.command()
@click.option('--admin-password', prompt=True, hide_input=True, help='Admin password')
def list(admin_password):
    """List configured providers."""
    provider_list(admin_password)


@provider.command()
@click.argument('name')
@click.option('--admin-password', prompt=True, hide_input=True, help='Admin password')
def remove(name, admin_password):
    """Remove a provider."""
    provider_remove(name, admin_password)


if __name__ == '__main__':
    cli()