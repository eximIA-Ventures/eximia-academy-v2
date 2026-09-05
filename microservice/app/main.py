"""FastAPI application entry point"""

from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import re
import structlog

from app.auth import require_internal_token, validate_startup_auth_config
from app.config import settings
from app.routes import health_router, blueprint_router

# Configure structlog
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger(__name__)


def build_cors_origin_regex() -> str:
    """Monta o allow_origin_regex do CORS (D15).

    Aceita:
      - o dominio base do app (ex.: academy.eximiaventures.com.br) e
        qualquer subdominio de tenant (ex.: cliente.academy.eximiaventures.com.br)
      - a origem exata configurada em NEXT_APP_URL (fallback/local)
      - localhost/127.0.0.1 em qualquer porta, fora de producao
    """
    alternatives = []

    if settings.app_base_domain:
        base = re.escape(settings.app_base_domain)
        alternatives.append(rf"https://([a-z0-9-]+\.)?{base}")

    if settings.next_app_url:
        alternatives.append(re.escape(settings.next_app_url))

    if settings.environment != "production":
        alternatives.append(r"http://localhost(:\d+)?")
        alternatives.append(r"http://127\.0\.0\.1(:\d+)?")

    if not alternatives:
        # Nenhuma origem configurada: nao casar com nada (fail closed).
        return r"^(?!)$"

    return r"^(" + "|".join(alternatives) + r")$"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup and shutdown events
    """
    # Falha fechado: nao sobe em producao com token interno padrao.
    validate_startup_auth_config()

    # Startup
    logger.info(
        "application_startup",
        service=settings.service_name,
        version=settings.service_version,
        environment=settings.environment,
    )

    yield

    # Shutdown
    logger.info("application_shutdown")


# Create FastAPI app
app = FastAPI(
    title=settings.service_name,
    version=settings.service_version,
    description="Blueprint Generation Microservice for exímIA Academy",
    lifespan=lifespan,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=build_cors_origin_regex(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Include routers
# /health fica fora da autenticacao interna (usado por healthcheck do orquestrador).
app.include_router(health_router)
app.include_router(blueprint_router, dependencies=[Depends(require_internal_token)])


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    logger.error(
        "unhandled_exception",
        path=request.url.path,
        method=request.method,
        error=str(exc),
        exc_info=True,
    )

    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "code": "INTERNAL_SERVER_ERROR",
            "message": "Internal server error",
        },
    )


@app.get("/", dependencies=[Depends(require_internal_token)])
async def root():
    """Root endpoint"""
    return {
        "service": settings.service_name,
        "version": settings.service_version,
        "status": "running",
    }
