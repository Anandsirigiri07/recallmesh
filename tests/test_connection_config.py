"""Unit tests for FalkorDB connection configuration, local defaults, and Cloud TLS/auth resolution."""

from unittest.mock import MagicMock, patch
import pytest

from src.recallmesh.connection import (
    FalkorDBConfig,
    _parse_bool,
    _parse_str,
    get_connection_config,
    get_falkordb_client,
    get_graph,
    ping_falkordb,
)


def test_parse_helpers():
    # Boolean parsing
    assert _parse_bool("true") is True
    assert _parse_bool("TRUE") is True
    assert _parse_bool("1") is True
    assert _parse_bool("yes") is True
    assert _parse_bool("false") is False
    assert _parse_bool("0") is False
    assert _parse_bool("no") is False
    assert _parse_bool(None, default=False) is False
    assert _parse_bool(None, default=True) is True

    # String normalization
    assert _parse_str(None) is None
    assert _parse_str("") is None
    assert _parse_str("   ") is None
    assert _parse_str("  default  ") == "default"


def test_default_local_config(monkeypatch):
    # Clear any FalkorDB env vars
    for key in [
        "FALKORDB_TARGET",
        "FALKORDB_HOST",
        "FALKORDB_PORT",
        "FALKORDB_USERNAME",
        "FALKORDB_PASSWORD",
        "FALKORDB_SSL",
        "FALKORDB_TLS",
        "FALKORDB_GRAPH_NAME",
        "RECALLMESH_GRAPH",
    ]:
        monkeypatch.delenv(key, raising=False)

    cfg = get_connection_config()
    assert cfg.host == "127.0.0.1"
    assert cfg.port == 6379
    assert cfg.username is None
    assert cfg.password is None
    assert cfg.ssl is False
    assert cfg.graph_name == "recallmesh"


def test_local_config_with_custom_env(monkeypatch):
    monkeypatch.setenv("FALKORDB_TARGET", "local")
    monkeypatch.setenv("FALKORDB_HOST", "192.168.1.100")
    monkeypatch.setenv("FALKORDB_PORT", "6380")
    monkeypatch.setenv("FALKORDB_GRAPH_NAME", "custom_mesh")
    monkeypatch.delenv("FALKORDB_PASSWORD", raising=False)

    cfg = get_connection_config()
    assert cfg.host == "192.168.1.100"
    assert cfg.port == 6380
    assert cfg.ssl is False
    assert cfg.graph_name == "custom_mesh"
    assert cfg.password is None


def test_cloud_config_target_selection(monkeypatch):
    monkeypatch.setenv("FALKORDB_TARGET", "cloud")
    monkeypatch.setenv("FALKORDB_CLOUD_HOST", "cloud.falkordb.example.com")
    monkeypatch.setenv("FALKORDB_CLOUD_PORT", "16379")
    monkeypatch.setenv("FALKORDB_CLOUD_USERNAME", "qa_lead")
    monkeypatch.setenv("FALKORDB_CLOUD_PASSWORD", "SuperSecureCloudPassword123")
    monkeypatch.setenv("FALKORDB_CLOUD_SSL", "true")
    monkeypatch.setenv("FALKORDB_CLOUD_GRAPH", "production_recallmesh")

    cfg = get_connection_config()
    assert cfg.host == "cloud.falkordb.example.com"
    assert cfg.port == 16379
    assert cfg.username == "qa_lead"
    assert cfg.password == "SuperSecureCloudPassword123"
    assert cfg.ssl is True
    assert cfg.graph_name == "production_recallmesh"


def test_cloud_config_defaults_ssl_to_true(monkeypatch):
    monkeypatch.setenv("FALKORDB_TARGET", "cloud")
    monkeypatch.setenv("FALKORDB_CLOUD_HOST", "cloud.falkordb.example.com")
    monkeypatch.delenv("FALKORDB_CLOUD_SSL", raising=False)
    monkeypatch.delenv("FALKORDB_SSL", raising=False)
    monkeypatch.delenv("FALKORDB_TLS", raising=False)

    cfg = get_connection_config()
    assert cfg.ssl is True


def test_get_falkordb_client_invokes_driver_with_full_params():
    with patch("src.recallmesh.connection.FalkorDB") as mock_falkor:
        get_falkordb_client(
            host="falkordb-cloud-node-01.falkordb.cloud",
            port=16379,
            username="test_admin",
            password="test_secret_pw",
            ssl=True,
        )
        mock_falkor.assert_called_once_with(
            host="falkordb-cloud-node-01.falkordb.cloud",
            port=16379,
            password="test_secret_pw",
            username="test_admin",
            ssl=True,
        )


def test_get_graph_passes_options_and_selects_graph():
    mock_client = MagicMock()
    with patch("src.recallmesh.connection.get_falkordb_client", return_value=mock_client) as mock_get_client:
        g = get_graph(
            graph_name="cloud_graph_target",
            host="cloud.falkordb.cloud",
            port=6379,
            password="secret_pass",
            username="default",
            ssl=True,
        )
        mock_get_client.assert_called_once_with(
            host="cloud.falkordb.cloud",
            port=6379,
            password="secret_pass",
            username="default",
            ssl=True,
        )
        mock_client.select_graph.assert_called_once_with("cloud_graph_target")


def test_ping_falkordb_success_and_failure():
    # Success scenario
    mock_client_success = MagicMock()
    mock_graph_success = MagicMock()
    mock_graph_success.query.return_value.result_set = [[1]]
    mock_client_success.select_graph.return_value = mock_graph_success

    with patch("src.recallmesh.connection.get_falkordb_client", return_value=mock_client_success):
        assert ping_falkordb(host="127.0.0.1", ssl=False) is True

    # Failure scenario (connection error)
    with patch("src.recallmesh.connection.get_falkordb_client", side_effect=ConnectionError("Socket closed")):
        assert ping_falkordb(host="bad.host", ssl=True) is False


def test_fastapi_active_graph_dependency():
    from src.recallmesh.api.dependencies import get_active_graph
    with patch("src.recallmesh.api.dependencies.get_graph") as mock_get_graph:
        get_active_graph()
        mock_get_graph.assert_called_once()
        _, kwargs = mock_get_graph.call_args
        assert "host" in kwargs
        assert "port" in kwargs
        assert "graph_name" in kwargs
        assert "password" in kwargs
        assert "username" in kwargs
        assert "ssl" in kwargs
