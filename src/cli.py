import argparse
import socket
import sys

import structlog
import uvicorn

from src.app.core.config import config_manager

logger = structlog.get_logger()


def is_port_available(host: str, port: int) -> bool:
    """Check if the port is available."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        # Allow reuse address to avoid false negatives on restart
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind((host, port))
            return True
        except OSError:
            return False


def start_server(args):
    """Start the uvicorn server."""
    # Load settings (config_manager updated in main if --config provided)
    settings = config_manager.config

    # CLI args override config
    host = args.host if args.host else settings.host
    port = args.port if args.port else settings.port

    # Check port availability
    if not is_port_available(host, port):
        print(f"Error: Port {port} on {host} is already in use.")
        sys.exit(1)

    print(f"Starting WIMS server on {host}:{port}")
    print(f"Using config: {config_manager.path}")

    uvicorn.run("src.app.main:app", host=host, port=port, reload=args.reload, log_level="info")


def reembed_command(args):
    """Re-embed documents with the current embedding model."""
    from src.app.db.client import db_client
    from src.app.db.migration import get_migration_status, promote_migration, run_full_migration

    # Get current config
    settings = config_manager.config
    embedding_config = settings.embedding.model_dump()

    print("Re-embedding Configuration:")
    print(f"  Provider: {embedding_config['provider']}")
    print(f"  Target model: {embedding_config['model']}")
    if embedding_config["provider"] in ("ollama", "openai"):
        print(f"  Base URL: {embedding_config['base_url']}")
    print(f"  Config file: {config_manager.path}\n")

    # If --promote flag, force promotion and exit
    if args.promote:
        try:
            table = db_client.get_table("messages")
            success = promote_migration(table)
            if success:
                print("Migration promotion complete! v2 vectors promoted to v1.")
            else:
                print("No migration to promote (vector_v2 column not found).")
        except Exception as e:
            print(f"Error during promotion: {e}")
            sys.exit(1)
        return

    # If --status flag, just show status and exit
    if args.status:
        try:
            table = db_client.get_table("messages")
            status = get_migration_status(table)

            print("Migration Status:")
            print(f"  Total documents: {status['total']}")
            print(f"  Migrated: {status['migrated']}")
            print(f"  Remaining: {status['remaining']}")
            print(f"  Progress: {status['percent_complete']:.1f}%")

            if status["has_v2"]:
                print("\n  Note: vector_v2 column exists (migration in progress)")
                print("  Auto-promotion will occur when all documents are re-embedded.")
            else:
                print("\n  Note: vector_v2 column not yet created (will be created on first run)")

        except Exception as e:
            print(f"Error checking migration status: {e}")
            sys.exit(1)

        return

    # Otherwise, run the full migration
    print("Starting re-embedding process...\n")

    try:
        run_full_migration(batch_size=args.batch_size, delay_seconds=args.delay)
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        print(f"\nError: Migration failed - {e}")
        sys.exit(1)

    print("\nRe-embedding completed successfully!")


def import_command(args):
    """Import conversations from a file."""
    import json
    from pathlib import Path

    from src.app.db.client import init_db

    file_path = Path(args.file)
    if not file_path.exists():
        print(f"Error: File not found: {file_path}")
        sys.exit(1)

    print(f"Reading {file_path}...")
    with open(file_path, encoding="utf-8") as f:
        data = json.load(f)

    fmt = args.format

    # Auto-detect format if not specified
    if fmt == "auto":
        if isinstance(data, dict) and "conversations" in data and "version" in data:
            fmt = "wims"
        elif isinstance(data, list) and len(data) > 0 and "mapping" in data[0]:
            fmt = "chatgpt"
        elif isinstance(data, list) and len(data) > 0 and ("chat_messages" in data[0] or "messages" in data[0]):
            fmt = "claude"
        else:
            print("Error: Could not auto-detect format. Use --format to specify.")
            sys.exit(1)
        print(f"Auto-detected format: {fmt}")

    # Initialize DB
    init_db()

    if fmt == "wims":
        from src.app.api.v1.endpoints.import_data import _embed_and_insert

        conversations = data.get("conversations", [])
        messages = []
        import uuid as _uuid

        for conv in conversations:
            conv_id = conv.get("conversation_id", str(_uuid.uuid4()))
            platform = conv.get("platform", "unknown")
            title = conv.get("title", "")
            url = conv.get("url", "")
            for msg in conv.get("messages", []):
                content = msg.get("content", "")
                if not content or not content.strip():
                    continue
                messages.append(
                    {
                        "id": msg.get("id", str(_uuid.uuid4())),
                        "conversation_id": conv_id,
                        "platform": platform,
                        "title": title,
                        "url": url,
                        "role": msg.get("role", "user"),
                        "content": content,
                        "timestamp": msg.get("timestamp"),
                    }
                )

        print(f"Found {len(messages)} messages in {len(conversations)} conversations")
        imported = _embed_and_insert(messages)

    elif fmt == "chatgpt":
        from src.app.api.v1.endpoints.import_data import _embed_and_insert, _parse_chatgpt_export

        messages = _parse_chatgpt_export(data)
        conv_count = len({m["conversation_id"] for m in messages})
        print(f"Found {len(messages)} messages in {conv_count} conversations")
        imported = _embed_and_insert(messages)

    elif fmt == "claude":
        from src.app.api.v1.endpoints.import_data import _embed_and_insert, _parse_claude_export

        messages = _parse_claude_export(data)
        conv_count = len({m["conversation_id"] for m in messages})
        print(f"Found {len(messages)} messages in {conv_count} conversations")
        imported = _embed_and_insert(messages)

    else:
        print(f"Error: Unknown format: {fmt}")
        sys.exit(1)

    print(f"Successfully imported {imported} messages.")


def mcp_command(args):
    """Start the MCP server."""
    from src.app.mcp_server import mcp

    print("Starting WIMS MCP server (stdio)...")
    mcp.run()


def main():
    parser = argparse.ArgumentParser(description="WIMS Management CLI")
    # Global args
    parser.add_argument("--config", help="Path to configuration file")

    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # start command
    start_parser = subparsers.add_parser("start", help="Start the server")
    start_parser.add_argument("--host", help="Bind host (overrides config)")
    start_parser.add_argument("--port", type=int, help="Bind port (overrides config)")
    start_parser.add_argument("--reload", action="store_true", help="Enable auto-reload")

    # reembed command
    reembed_parser = subparsers.add_parser("reembed", help="Re-embed documents with current model")
    reembed_parser.add_argument("--batch-size", type=int, default=100, help="Documents per batch")
    reembed_parser.add_argument("--delay", type=float, default=0.5, help="Seconds between batches")
    reembed_parser.add_argument("--status", action="store_true", help="Show migration status only")
    reembed_parser.add_argument("--promote", action="store_true", help="Force promote v2 to v1 without re-embedding")

    # import command
    import_parser = subparsers.add_parser("import", help="Import conversations from a file")
    import_parser.add_argument("file", help="Path to the file to import")
    import_parser.add_argument(
        "--format",
        default="auto",
        choices=["auto", "wims", "chatgpt", "claude"],
        help="Import format (default: auto-detect)",
    )

    # mcp command
    subparsers.add_parser("mcp", help="Start the MCP server (stdio transport)")

    args = parser.parse_args()

    # Update config path if provided
    if args.config:
        config_manager.set_config_path(args.config)

    if args.command == "start":
        start_server(args)
    elif args.command == "reembed":
        reembed_command(args)
    elif args.command == "import":
        import_command(args)
    elif args.command == "mcp":
        mcp_command(args)
    else:
        # Default to help if no command
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
