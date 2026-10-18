"""Command-line interface for RECALLMESH local graph operations.

Enables straightforward execution of seeding, downstream/upstream tracing,
gap detection, and containment action plan generation.
"""

import argparse
import json
import sys
from pathlib import Path

from src.recallmesh.connection import get_graph, ping_falkordb
from src.recallmesh.loader import load_scenario
from src.recallmesh.tracer import (
    build_containment_action_plan,
    detect_traceability_gaps,
    execute_containment_action_plan,
    trace_downstream,
    trace_upstream,
    GovernanceException,
)


def main():
    parser = argparse.ArgumentParser(description="RECALLMESH Graph Operations CLI")
    parser.add_argument("--host", default=None, help="FalkorDB host (default: from FALKORDB_HOST or 127.0.0.1)")
    parser.add_argument("--port", type=int, default=None, help="FalkorDB port (default: from FALKORDB_PORT or 6379)")
    parser.add_argument("--graph", default=None, help="Graph name (default: from FALKORDB_GRAPH_NAME or recallmesh)")
    parser.add_argument("--username", default=None, help="FalkorDB username (default: from env)")
    parser.add_argument("--password", default=None, help="FalkorDB password (default: from env)")
    parser.add_argument("--ssl", action="store_true", default=None, help="Enable SSL/TLS for FalkorDB Cloud")

    subparsers = parser.add_subparsers(dest="command", required=True)

    # ping
    subparsers.add_parser("ping", help="Ping FalkorDB database")

    # seed
    seed_parser = subparsers.add_parser("seed", help="Load scenario fixture into FalkorDB")
    seed_parser.add_argument(
        "--fixture",
        default="data/demo/recall_scenario.json",
        help="Path to scenario JSON fixture",
    )
    seed_parser.add_argument(
        "--reset",
        action="store_true",
        help="Explicitly delete existing graph data before loading",
    )

    # trace-downstream
    down_parser = subparsers.add_parser("trace-downstream", help="Run downstream forward blast radius trace")
    down_parser.add_argument("raw_lot", help="Raw lot code (e.g., LOT-CUM-2026-088)")

    # trace-upstream
    up_parser = subparsers.add_parser("trace-upstream", help="Run upstream backward root-cause trace")
    up_parser.add_argument("finished_lot", help="Finished lot code (e.g., FL-SALSA-101)")

    # detect-gaps
    subparsers.add_parser("detect-gaps", help="Scan for broken traceability chains and gaps")

    # plan-containment
    plan_parser = subparsers.add_parser("plan-containment", help="Build containment action plan")
    plan_parser.add_argument("raw_lot", help="Suspect raw lot code")
    plan_parser.add_argument("--case-id", default="CASE-2026-004", help="Recall case identifier")
    plan_parser.add_argument(
        "--authorize",
        default=None,
        help="Authorizer email to simulate human sign-off on action plan",
    )

    args = parser.parse_args()

    if args.command == "ping":
        healthy = ping_falkordb(
            host=args.host,
            port=args.port,
            password=args.password,
            username=args.username,
            ssl=args.ssl,
        )
        if healthy:
            print("OK: FalkorDB is reachable and responsive.")
            sys.exit(0)
        else:
            print("ERROR: FalkorDB is unreachable.", file=sys.stderr)
            sys.exit(1)

    graph = get_graph(
        graph_name=args.graph,
        host=args.host,
        port=args.port,
        password=args.password,
        username=args.username,
        ssl=args.ssl,
    )

    if args.command == "seed":
        print(f"Loading fixture '{args.fixture}' into graph '{args.graph or 'active graph'}' (reset={args.reset})...")
        counts = load_scenario(args.fixture, graph, reset=args.reset)
        print("Seeding complete. Entity counts:")
        print(json.dumps(counts, indent=2))

    elif args.command == "trace-downstream":
        res = trace_downstream(graph, args.raw_lot)
        print(json.dumps(res, indent=2))

    elif args.command == "trace-upstream":
        res = trace_upstream(graph, args.finished_lot)
        print(json.dumps(res, indent=2))

    elif args.command == "detect-gaps":
        res = detect_traceability_gaps(graph)
        print(json.dumps(res, indent=2))

    elif args.command == "plan-containment":
        plan = build_containment_action_plan(graph, args.raw_lot, case_id=args.case_id)
        if args.authorize:
            print(f"Authorizing containment plan under signature: {args.authorize}...")
            executed = execute_containment_action_plan(graph, plan, authorized_by=args.authorize)
            print(json.dumps(executed, indent=2))
        else:
            print("Generated Proposed Containment Plan (Awaiting Human Authorization):")
            print(json.dumps(plan, indent=2))


if __name__ == "__main__":
    main()
