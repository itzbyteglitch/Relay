from unittest.mock import MagicMock, patch

import httpx
from click.testing import CliRunner


class TestSetup:
    def test_setup_success(self):
        with patch('relay_cli.setup.httpx.Client') as mock_client_class:
            mock_client = MagicMock()
            mock_client_class.return_value.__enter__.return_value = mock_client
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {'token': 'test-device-token'}
            mock_client.post.return_value = mock_response

            with patch('relay_cli.setup.set_token') as mock_set_token:
                with patch('relay_cli.setup.write_config') as mock_write_config:
                    from relay_cli.cli import cli
                    runner = CliRunner()
                    result = runner.invoke(cli, ['setup', '--server-url', 'https://test.example.com', '--password', 'testpass', '--device-name', 'Test Device'])
                    assert result.exit_code == 0
                    assert 'Success' in result.output
                    mock_set_token.assert_called_once()
                    mock_write_config.assert_called_once()

    def test_setup_invalid_password(self):
        with patch('relay_cli.setup.httpx.Client') as mock_client_class:
            mock_client = MagicMock()
            mock_client_class.return_value.__enter__.return_value = mock_client
            mock_response = MagicMock()
            mock_response.status_code = 401
            mock_client.post.return_value = mock_response

            from relay_cli.cli import cli
            runner = CliRunner()
            result = runner.invoke(cli, ['setup', '--server-url', 'https://test.example.com', '--password', 'wrongpass', '--device-name', 'Test Device'])
            assert result.exit_code == 1
            assert 'Invalid password' in result.output

    def test_setup_device_exists(self):
        with patch('relay_cli.setup.httpx.Client') as mock_client_class:
            mock_client = MagicMock()
            mock_client_class.return_value.__enter__.return_value = mock_client
            mock_response = MagicMock()
            mock_response.status_code = 409
            mock_client.post.return_value = mock_response

            from relay_cli.cli import cli
            runner = CliRunner()
            result = runner.invoke(cli, ['setup', '--server-url', 'https://test.example.com', '--password', 'testpass', '--device-name', 'Test Device'])
            assert result.exit_code == 1
            assert 'Device already registered' in result.output

    def test_setup_rate_limited(self):
        with patch('relay_cli.setup.httpx.Client') as mock_client_class:
            mock_client = MagicMock()
            mock_client_class.return_value.__enter__.return_value = mock_client
            mock_response = MagicMock()
            mock_response.status_code = 429
            mock_client.post.return_value = mock_response

            from relay_cli.cli import cli
            runner = CliRunner()
            result = runner.invoke(cli, ['setup', '--server-url', 'https://test.example.com', '--password', 'testpass', '--device-name', 'Test Device'])
            assert result.exit_code == 1
            assert 'Rate limited' in result.output

    def test_setup_connection_error(self):
        with patch('relay_cli.setup.httpx.Client') as mock_client_class:
            mock_client = MagicMock()
            mock_client_class.return_value.__enter__.return_value = mock_client
            mock_client.post.side_effect = httpx.ConnectError('Connection failed')

            from relay_cli.cli import cli
            runner = CliRunner()
            result = runner.invoke(cli, ['setup', '--server-url', 'https://test.example.com', '--password', 'testpass', '--device-name', 'Test Device'])
            assert result.exit_code == 1
            assert 'Could not connect' in result.output

    def test_setup_invalid_url(self):
        from relay_cli.cli import cli
        runner = CliRunner()
        result = runner.invoke(cli, ['setup', '--server-url', 'invalid-url', '--password', 'testpass', '--device-name', 'Test Device'])
        assert result.exit_code == 1
        assert 'must start with http' in result.output