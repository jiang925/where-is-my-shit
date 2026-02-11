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

    args = parser.parse_args()

    # Update config path if provided
    if args.config:
        config_manager.set_config_path(args.config)

    if args.command == "start":
        start_server(args)
    else:
        # Default to help if no command
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
