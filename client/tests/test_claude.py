import importlib
import sys
from unittest.mock import MagicMock, patch

from click.testing import CliRunner


def reload_claude_module():
    """Force reload the claude module to get fresh state."""
    for mod in list(sys.modules.keys()):
        if 'relay_cli.claude' in mod:
            del sys.modules[mod]
    import relay_cli.claude as claude_module
    importlib.reload(claude_module)
    return claude_module


def import_cli_with_patches(read_config_return=None, get_token_return=None, subprocess_run_return=None, subprocess_run_side_effect=None):
    """Import cli with patches applied."""
    patches = []
    
    if read_config_return is not None:
        patches.append(patch('relay_cli.config.read_config', return_value=read_config_return))
        patches.append(patch('relay_cli.claude.read_config', return_value=read_config_return))
    else:
        # When read_config returns None, we also need to mock get_token to return None
        patches.append(patch('relay_cli.config.read_config', return_value=None))
        patches.append(patch('relay_cli.claude.read_config', return_value=None))
        patches.append(patch('relay_cli.config.get_token', return_value=None))
        patches.append(patch('relay_cli.claude.get_token', return_value=None))
    
    if get_token_return is not None:
        patches.append(patch('relay_cli.config.get_token', return_value=get_token_return))
        patches.append(patch('relay_cli.claude.get_token', return_value=get_token_return))
    
    if subprocess_run_return is not None:
        patches.append(patch('relay_cli.claude.subprocess.run', return_value=subprocess_run_return))
    
    if subprocess_run_side_effect is not None:
        patches.append(patch('relay_cli.claude.subprocess.run', side_effect=subprocess_run_side_effect))
    
    # Remove cached modules to force re-import
    for mod in ['relay_cli.cli', 'relay_cli.claude', 'relay_cli.config', 'relay_cli.provider', 'relay_cli.setup']:
        if mod in sys.modules:
            del sys.modules[mod]
    
    # Apply all patches
    for p in patches:
        p.start()
    
    try:
        from relay_cli.cli import cli
        return cli, patches
    except Exception:
        for p in patches:
            p.stop()
        raise


class TestClaude:
    def test_claude_not_configured(self):
        cli, patches = import_cli_with_patches(read_config_return=None)
        try:
            runner = CliRunner()
            result = runner.invoke(cli, ['claude'])
            assert result.exit_code == 1
            assert 'Not configured' in result.output
        finally:
            for p in patches:
                p.stop()

    def test_claude_no_token(self):
        cli, patches = import_cli_with_patches(
            read_config_return=MagicMock(device_uuid='test-uuid'),
            get_token_return=None
        )
        try:
            runner = CliRunner()
            result = runner.invoke(cli, ['claude'])
            assert result.exit_code == 1
            assert 'No token found' in result.output
        finally:
            for p in patches:
                p.stop()

    def test_claude_success(self):
        cli, patches = import_cli_with_patches(
            read_config_return=MagicMock(server_url='https://test.example.com', device_uuid='test-uuid'),
            get_token_return='device-token',
            subprocess_run_return=MagicMock(returncode=0)
        )
        try:
            runner = CliRunner()
            result = runner.invoke(cli, ['claude', '--', '--help'])
            assert result.exit_code == 0
        finally:
            for p in patches:
                p.stop()

    def test_claude_claude_not_found(self):
        cli, patches = import_cli_with_patches(
            read_config_return=MagicMock(server_url='https://test.example.com', device_uuid='test-uuid'),
            get_token_return='device-token',
            subprocess_run_side_effect=FileNotFoundError()
        )
        try:
            runner = CliRunner()
            result = runner.invoke(cli, ['claude'])
            assert result.exit_code == 1
            assert 'command not found' in result.output
        finally:
            for p in patches:
                p.stop()