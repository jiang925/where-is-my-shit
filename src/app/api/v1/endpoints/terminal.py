import platform
import subprocess
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.app.core.auth import verify_api_key

router = APIRouter(dependencies=[Depends(verify_api_key)])


class OpenTerminalRequest(BaseModel):
    path: str


@router.post("/open-terminal")
async def open_terminal(request: OpenTerminalRequest):
    """
    Open the user's terminal at the given directory path.
    Only works on the local machine (macOS / Linux).
    """
    dir_path = Path(request.path).expanduser().resolve()

    if not dir_path.exists():
        raise HTTPException(status_code=404, detail="Directory not found")

    if not dir_path.is_dir():
        # If it's a file, open the parent directory
        dir_path = dir_path.parent
        if not dir_path.exists():
            raise HTTPException(status_code=404, detail="Directory not found")

    system = platform.system()

    try:
        if system == "Darwin":
            # macOS: open Terminal.app at the directory
            subprocess.Popen(["open", "-a", "Terminal", str(dir_path)])
        elif system == "Linux":
            # Linux: try common terminal emulators
            for term in ["xdg-open", "gnome-terminal", "xterm"]:
                try:
                    if term == "gnome-terminal":
                        subprocess.Popen([term, "--working-directory", str(dir_path)])
                    elif term == "xdg-open":
                        # xdg-open doesn't support terminal directly, skip
                        continue
                    else:
                        subprocess.Popen([term, "-e", f"cd {str(dir_path)} && $SHELL"])
                    break
                except FileNotFoundError:
                    continue
            else:
                raise HTTPException(
                    status_code=500,
                    detail="No supported terminal emulator found",
                )
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Unsupported platform: {system}",
            )
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=f"Failed to open terminal: {str(e)}")

    return {"opened": str(dir_path)}
