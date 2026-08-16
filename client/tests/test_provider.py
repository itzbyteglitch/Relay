from unittest.mock import MagicMock, patch

from click.testing import CliRunner


class TestProvider:
    def test_provider_add_success(self):
        with patch('relay_cli.provider.read_config') as mock_read_config:
            mock_read_config.return_value = MagicMock(server_url='https://test.example.com')
            with patch('relay_cli.provider.get_admin_token', return_value='admin-token'):
                with patch('relay_cli.provider.httpx.Client') as mock_client_class:
                    mock_client = MagicMock()
                    mock_client_class.return_value.__enter__.return_value = mock_client
                    mock_response = MagicMock()
                    mock_response.status_code = 200
                    mock_client.post.return_value = mock_response

                    from relay_cli.cli import cli
                    runner = CliRunner()
                    result = runner.invoke(cli, ['provider', 'add', 'nvidia_nim', '--key', 'test-key', '--admin-password', 'adminpass'])
                    assert result.exit_code == 0
                    assert 'Success' in result.output

    def test_provider_add_invalid_admin(self):
        with patch('relay_cli.provider.read_config') as mock_read_config:
            mock_read_config.return_value = MagicMock(server_url='https://test.example.com')
            with patch('relay_cli.provider.get_admin_token') as mock_get_admin:
                mock_get_admin.side_effect = SystemExit(1)

                from relay_cli.cli import cli
                runner = CliRunner()
                result = runner.invoke(cli, ['provider', 'add', 'nvidia_nim', '--key', 'test-key', '--admin-password', 'wrongpass'])
                assert result.exit_code == 1

    def test_provider_list_success(self):
        with patch('relay_cli.provider.read_config') as mock_read_config:
            mock_read_config.return_value = MagicMock(server_url='https://test.example.com')
            with patch('relay_cli.provider.get_admin_token', return_value='admin-token'):
                with patch('relay_cli.provider.httpx.Client') as mock_client_class:
                    mock_client = MagicMock()
                    mock_client_class.return_value.__enter__.return_value = mock_client
                    mock_response = MagicMock()
                    mock_response.status_code = 200
                    mock_response.json.return_value = {
                        'providers': [
                            {
                                'name': 'nvidia_nim',
                                'transport': 'openai',
                                'base_url': 'https://integrate.api.nvidia.com/v1',
                                'model_prefix': 'nvidia_nim/',
                                'enabled': True,
                                'key': '***'
                            }
                        ]
                    }
                    mock_client.get.return_value = mock_response

                    from relay_cli.cli import cli
                    runner = CliRunner()
                    result = runner.invoke(cli, ['provider', 'list', '--admin-password', 'adminpass'])
                    assert result.exit_code == 0
                    assert 'nvidia_nim' in result.output

    def test_provider_remove_success(self):
        with patch('relay_cli.provider.read_config') as mock_read_config:
            mock_read_config.return_value = MagicMock(server_url='https://test.example.com')
            with patch('relay_cli.provider.get_admin_token', return_value='admin-token'):
                with patch('relay_cli.provider.httpx.Client') as mock_client_class:
                    mock_client = MagicMock()
                    mock_client_class.return_value.__enter__.return_value = mock_client
                    mock_response = MagicMock()
                    mock_response.status_code = 200
                    mock_client.delete.return_value = mock_response

                    from relay_cli.cli import cli
                    runner = CliRunner()
                    result = runner.invoke(cli, ['provider', 'remove', 'nvidia_nim', '--admin-password', 'adminpass'])
                    assert result.exit_code == 0
                    assert 'Success' in result.output

    def test_provider_add_custom_success(self):
        with patch('relay_cli.provider.read_config') as mock_read_config:
            mock_read_config.return_value = MagicMock(server_url='https://test.example.com')
            with patch('relay_cli.provider.get_admin_token', return_value='admin-token'):
                with patch('relay_cli.provider.httpx.Client') as mock_client_class:
                    mock_client = MagicMock()
                    mock_client_class.return_value.__enter__.return_value = mock_client
                    mock_response = MagicMock()
                    mock_response.status_code = 200
                    mock_client.post.return_value = mock_response

                    from relay_cli.cli import cli
                    runner = CliRunner()
                    result = runner.invoke(cli, ['provider', 'add-custom', 'custom', '--base-url', 'https://custom.example.com', '--key', 'test-key', '--schema', 'openai', '--admin-password', 'adminpass'])
                    assert result.exit_code == 0
                    assert 'Success' in result.output