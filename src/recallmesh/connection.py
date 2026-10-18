"""FalkorDB connection management module for RECALLMESH.

Provides clean connection pooling, configuration resolution, and graph instance
management for both local Docker development and FalkorDB Cloud environments.
Defaults strictly to localhost loopback (127.0.0.1) on port 6379.
"""

from dataclasses import dataclass
import os
from typing import Optional
from falkordb import FalkorDB, Graph


@dataclass(frozen=True)
class FalkorDBConfig:
    """Connection parameters for FalkorDB."""
    host: str = "127.0.0.1"
    port: int = 6379
    username: Optional[str] = None
    password: Optional[str] = None
    ssl: bool = False
    graph_name: str = "recallmesh"


def _parse_bool(val: Optional[str], default: bool = False) -> bool:
    """Parses environment string into boolean."""
    if val is None:
        return default
    return str(val).strip().lower() in ("true", "1", "yes", "t", "y", "on")


def _parse_str(val: Optional[str]) -> Optional[str]:
    """Strips whitespace and converts empty strings to None."""
    if val is None:
        return None
    val_clean = str(val).strip()
    return val_clean if val_clean else None


def get_connection_config() -> FalkorDBConfig:
    """Resolves FalkorDB connection configuration with explicit target selection.

    Target modes (selected via FALKORDB_TARGET or RECALLMESH_ENV):
    - 'local' (default): Connects to local Docker container at 127.0.0.1:6379 without authentication or SSL.
    - 'cloud': Connects to FalkorDB Cloud endpoint with authentication and TLS.
    """
    target = os.getenv("FALKORDB_TARGET", "local").strip().lower()

    if target == "cloud":
        host = os.getenv("FALKORDB_CLOUD_HOST") or os.getenv("FALKORDB_HOST", "127.0.0.1")
        port_raw = os.getenv("FALKORDB_CLOUD_PORT") or os.getenv("FALKORDB_PORT", "6379")
        username = os.getenv("FALKORDB_CLOUD_USERNAME") or os.getenv("FALKORDB_USERNAME") or "default"
        password = os.getenv("FALKORDB_CLOUD_PASSWORD") or os.getenv("FALKORDB_PASSWORD")
        ssl_raw = os.getenv("FALKORDB_CLOUD_SSL") or os.getenv("FALKORDB_SSL") or os.getenv("FALKORDB_TLS", "true")
        graph_name = (
            os.getenv("FALKORDB_CLOUD_GRAPH")
            or os.getenv("FALKORDB_GRAPH_NAME")
            or os.getenv("RECALLMESH_GRAPH")
            or "recallmesh"
        )
        return FalkorDBConfig(
            host=host.strip(),
            port=int(port_raw),
            username=_parse_str(username),
            password=_parse_str(password),
            ssl=_parse_bool(ssl_raw, default=True),
            graph_name=graph_name.strip(),
        )

    # Local mode (default):
    host = os.getenv("FALKORDB_HOST", "127.0.0.1").strip()
    port = int(os.getenv("FALKORDB_PORT", "6379"))
    username = os.getenv("FALKORDB_USERNAME")
    password = os.getenv("FALKORDB_PASSWORD")
    ssl_raw = os.getenv("FALKORDB_SSL") or os.getenv("FALKORDB_TLS", "false")
    graph_name = os.getenv("FALKORDB_GRAPH_NAME") or os.getenv("RECALLMESH_GRAPH") or "recallmesh"

    return FalkorDBConfig(
        host=host,
        port=port,
        username=_parse_str(username),
        password=_parse_str(password),
        ssl=_parse_bool(ssl_raw, default=False),
        graph_name=graph_name.strip(),
    )


def get_falkordb_client(
    host: Optional[str] = None,
    port: Optional[int] = None,
    password: Optional[str] = None,
    username: Optional[str] = None,
    ssl: Optional[bool] = None,
) -> FalkorDB:
    """Creates a FalkorDB client instance connecting to local or Cloud host with full TLS and auth options."""
    cfg = get_connection_config()
    final_host = host if host is not None else cfg.host
    final_port = port if port is not None else cfg.port
    final_password = password if password is not None else cfg.password
    final_username = username if username is not None else cfg.username
    final_ssl = ssl if ssl is not None else cfg.ssl

    return FalkorDB(
        host=final_host,
        port=final_port,
        password=final_password,
        username=final_username,
        ssl=final_ssl,
    )


def get_graph(
    graph_name: Optional[str] = None,
    host: Optional[str] = None,
    port: Optional[int] = None,
    password: Optional[str] = None,
    username: Optional[str] = None,
    ssl: Optional[bool] = None,
) -> Graph:
    """Selects and returns a FalkorDB Graph instance by name."""
    cfg = get_connection_config()
    final_graph = graph_name if graph_name is not None else cfg.graph_name
    client = get_falkordb_client(
        host=host,
        port=port,
        password=password,
        username=username,
        ssl=ssl,
    )
    return client.select_graph(final_graph)


def ping_falkordb(
    host: Optional[str] = None,
    port: Optional[int] = None,
    password: Optional[str] = None,
    username: Optional[str] = None,
    ssl: Optional[bool] = None,
) -> bool:
    """Verifies that the FalkorDB database is reachable and responsive."""
    try:
        client = get_falkordb_client(
            host=host,
            port=port,
            password=password,
            username=username,
            ssl=ssl,
        )
        temp_graph = client.select_graph("_ping_check")
        res = temp_graph.query("RETURN 1 AS ping")
        temp_graph.delete()
        return bool(res.result_set and res.result_set[0][0] == 1)
    except Exception:
        return False
