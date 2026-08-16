import importlib
import json
import sys
from pathlib import Path
from unittest.mock import patch


def reload_config_module():
    """Force reload the config module to get fresh state."""
    for mod in list(sys.modules.keys()):
        if 'relay_cli' in mod:
            del sys.modules[mod]
    import relay_cli.config as config_module
    importlib.reload(config_module)
    return config_module


class TestConfig:
    def test_read_config_nonexistent(self):
        config_module = reload_config_module()
        with patch('relay_cli.config.CONFIG_FILE', Path('/nonexistent/config.json')):
            assert config_module.read_config() is None

    def test_read_write_config(self, tmp_path):
        config_module = reload_config_module()
        config_file = tmp_path / 'config.json'
        with patch('relay_cli.config.CONFIG_FILE', config_file):
            config = config_module.Config(server_url='https://test.example.com', device_uuid='test-uuid', device_name='Test Device')
            config_module.write_config(config)
            read = config_module.read_config()
            assert read is not None
            assert read.server_url == 'https://test.example.com'
            assert read.device_uuid == 'test-uuid'
            assert read.device_name == 'Test Device'


def reload_crypto_module():
    """Force reload the crypto module to get fresh state."""
    for mod in list(sys.modules.keys()):
        if 'relay_cli' in mod:
            del sys.modules[mod]
    import relay_cli.crypto as crypto_module
    importlib.reload(crypto_module)
    return crypto_module


class TestCrypto:
    def test_derive_key(self):
        crypto_module = reload_crypto_module()
        key1 = crypto_module.derive_key('test-uuid')
        key2 = crypto_module.derive_key('test-uuid')
        assert key1 == key2
        assert len(key1) == 32

    def test_encrypt_decrypt_roundtrip(self):
        crypto_module = reload_crypto_module()
        token = 'test-token-123'
        device_uuid = 'test-uuid'
        encrypted = crypto_module.encrypt_token(token, device_uuid)
        decrypted = crypto_module.decrypt_token(encrypted, device_uuid)
        assert decrypted == token

    def test_different_uuids_different_keys(self):
        crypto_module = reload_crypto_module()
        token = 'test-token'
        encrypted1 = crypto_module.encrypt_token(token, 'uuid-1')
        encrypted2 = crypto_module.encrypt_token(token, 'uuid-2')
        assert encrypted1 != encrypted2


class TestTokenStorage:
    def test_get_token_keyring_success(self):
        config_module = reload_config_module()
        with patch('relay_cli.config.keyring.get_password', return_value='keyring-token'):
            token = config_module.get_token('test-uuid')
            assert token == 'keyring-token'

    def test_get_token_fallback_success(self, tmp_path):
        config_module = reload_config_module()
        config_file = tmp_path / 'config.json'
        with patch('relay_cli.config.CONFIG_FILE', config_file):
            with patch('relay_cli.config.keyring.get_password', side_effect=Exception('keyring unavailable')):
                config = config_module.Config(server_url='https://test.example.com', device_uuid='test-uuid', device_name='Test')
                encrypted = config_module.encrypt_token('fallback-token', 'test-uuid')
                config_dict = {'server_url': config.server_url, 'device_uuid': config.device_uuid, 'device_name': config.device_name, 'encrypted_token': encrypted}
                with open(config_file, 'w') as f:
                    json.dump(config_dict, f)
                token = config_module.get_token('test-uuid')
                assert token == 'fallback-token'

    def test_set_token_keyring_success(self):
        config_module = reload_config_module()
        with patch('relay_cli.config.keyring.set_password') as mock_set:
            config_module.set_token('test-uuid', 'test-token')
            mock_set.assert_called_once_with('relay-cli', 'test-uuid', 'test-token')

    def test_set_token_fallback(self, tmp_path):
        config_module = reload_config_module()
        config_file = tmp_path / 'config.json'
        with patch('relay_cli.config.CONFIG_FILE', config_file):
            with patch('relay_cli.config.keyring.set_password', side_effect=Exception('keyring unavailable')):
                config = config_module.Config(server_url='https://test.example.com', device_uuid='test-uuid', device_name='Test')
                config_module.write_config(config)
                config_module.set_token('test-uuid', 'fallback-token')
                read = config_module.read_config()
                assert read is not None
                assert hasattr(read, 'encrypted_token')
                decrypted = config_module.decrypt_token(read.encrypted_token, 'test-uuid')
                assert decrypted == 'fallback-token'

    def test_delete_token(self):
        config_module = reload_config_module()
        with patch('relay_cli.config.keyring.delete_password') as mock_delete:
            config_module.delete_token('test-uuid')
            mock_delete.assert_called_once_with('relay-cli', 'test-uuid')