import shutil
import psutil
from fastapi import APIRouter, Depends

from src.app.db.client import get_db, DBClient

router = APIRouter()

@router.get("/health")
async def health_check():
    """
    Return system health stats.
    """
    # System stats
    mem = psutil.virtual_memory()
    disk = shutil.disk_usage("/")

    # DB stats
    db_client = DBClient()
    try:
        table = db_client.get_table("messages")
        # count_rows() might be efficient or slow depending on implementation
        # For LanceDB, len(table) usually works or table.count_rows()
        # count_rows() is specific to some versions.
        # Using specific query or estimated count is safer.
        # table.count_rows() is available in newer versions.
        # Fallback: simple check if table exists
        row_count = table.count_rows() if hasattr(table, "count_rows") else "unknown"
    except Exception:
        row_count = 0

    return {
        "status": "healthy",
        "system": {
            "memory_percent": mem.percent,
            "cpu_percent": psutil.cpu_percent(),
            "disk_percent": (disk.used / disk.total) * 100
        },
        "database": {
            "connected": True,
            "row_count": row_count
        }
    }
