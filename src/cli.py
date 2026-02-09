import argparse
import sys
import uvicorn
import structlog
from getpass import getpass

from src.app.core.auth import get_password_hash, generate_strong_password
from src.app.db.auth import AuthDB

logger = structlog.get_logger()

def reset_password(args):
    """Reset the admin password."""
    # Ensure DB dir exists
    auth_db = AuthDB()
    auth_db.initialize()

    if args.auto:
        new_password = generate_strong_password()
        print(f"Generated new password: {new_password}")
    else:
        print("Enter new admin password:")
        p1 = getpass("Password: ")
        p2 = getpass("Confirm: ")

        if p1 != p2:
            print("Error: Passwords do not match.")
            sys.exit(1)

        if not p1:
            print("Error: Password cannot be empty.")
            sys.exit(1)

        new_password = p1

    hashed_pw = get_password_hash(new_password)

    # Update password and invalidate old tokens
    auth_db.update_password(hashed_pw)
    print("Password updated successfully. All existing sessions have been invalidated.")

def start_server(args):
    """Start the uvicorn server."""
    # We import main app here to avoid circular imports or early init issues if just running CLI tools
    print(f"Starting WIMS server on {args.host}:{args.port}")

    uvicorn.run(
        "src.app.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level="info"
    )

def main():
    parser = argparse.ArgumentParser(description="WIMS Management CLI")
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # reset-password command
    pwd_parser = subparsers.add_parser("reset-password", help="Reset admin password")
    pwd_parser.add_argument("--auto", action="store_true", help="Auto-generate a strong password")

    # start command
    start_parser = subparsers.add_parser("start", help="Start the server")
    start_parser.add_argument("--host", default="127.0.0.1", help="Bind host (default: 127.0.0.1)")
    start_parser.add_argument("--port", type=int, default=8000, help="Bind port (default: 8000)")
    start_parser.add_argument("--reload", action="store_true", help="Enable auto-reload")

    args = parser.parse_args()

    if args.command == "reset-password":
        reset_password(args)
    elif args.command == "start":
        start_server(args)
    else:
        parser.print_help()
        sys.exit(1)

if __name__ == "__main__":
    main()
