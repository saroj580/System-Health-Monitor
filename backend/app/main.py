"""
app/main.py
FastAPI application factory.
Creates the app instance, registers middleware and routers, and
hooks database initialization into the startup lifecycle.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import APP_NAME, APP_VERSION, HOST, PORT
from app.core.database import init_db
from app.views.routes import router

# Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


# Lifespan (startup / shutdown)
@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup
    logger.info("Starting %s v%s on %s:%d", APP_NAME, APP_VERSION, HOST, PORT)
    init_db()
    yield
    # shutdown 
    logger.info("Shutting down %s — goodbye.", APP_NAME)


# App factory
def create_app() -> FastAPI:
    app = FastAPI(
        title=APP_NAME,
        version=APP_VERSION,
        description=(
            "Local REST API and WebSocket server for the System Monitor & "
            "Task Automator desktop application."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # CORS — only allow requests from the local Electron/Vite origin
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",   # Vite dev server
            "http://localhost:3000",   # Alternative dev port
            "app://.",                 # Electron production origin
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(router)
    return app


app = create_app()
