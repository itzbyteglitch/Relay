import sys

import pytest


@pytest.fixture(autouse=True)
def reset_modules():
    """Reset module state between tests to ensure isolation."""
    # Modules to reset
    modules_to_reset = [
        'relay_cli.config',
        'relay_cli.crypto',
        'relay_cli.claude',
        'relay_cli.provider',
        'relay_cli.setup',
        'relay_cli.cli',
    ]
    
    # Remove from sys.modules to force re-import
    for mod in modules_to_reset:
        if mod in sys.modules:
            del sys.modules[mod]
    
    yield
    
    # Clean up after test
    for mod in modules_to_reset:
        if mod in sys.modules:
            del sys.modules[mod]


@pytest.fixture
def temp_config_file(tmp_path):
    """Provide a temporary config file path."""
    config_file = tmp_path / 'config.json'
    return config_file