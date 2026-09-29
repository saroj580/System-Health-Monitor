"""
run.py
Uvicorn entry point.
Used in development AND as the PyInstaller __main__ entry point so that
the compiled backend.exe works identically to `python run.py`.
"""

import uvicorn
from app.core.config import HOST, PORT

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=HOST,
        port=PORT,
        reload=False,           # False — also required for PyInstaller
        log_level="info",
        workers=1,              # Single worker (desktop app, not a web server)
    )
