"""Autenticacao interna do microservico (D15).

Este microservico nao e exposto diretamente a internet: ele so deve ser
chamado pelo proxy Next.js (apps/web/src/app/api/blueprint/**). Para reduzir
o risco de chamadas diretas (SSRF, exposicao acidental de porta, etc.), toda
rota exceto /health exige um token compartilhado.

O cliente deve enviar o token em um dos dois formatos:
  - Header "X-Internal-Token: <token>"
  - Header "Authorization: Bearer <token>"
"""

from fastapi import Header, HTTPException, status
from typing import Optional
import structlog

from app.config import settings

logger = structlog.get_logger(__name__)

DEFAULT_DEV_TOKEN = "dev-token-change-in-prod"


def validate_startup_auth_config() -> None:
    """Falha fechado no startup se producao estiver rodando com o token padrao.

    Deve ser chamado no lifespan da aplicacao, antes de aceitar requests.
    """
    if settings.environment == "production" and settings.internal_auth_token == DEFAULT_DEV_TOKEN:
        raise RuntimeError(
            "INTERNAL_AUTH_TOKEN nao pode ser o valor padrao "
            f"'{DEFAULT_DEV_TOKEN}' quando ENVIRONMENT=production. "
            "Defina um token forte via variavel de ambiente INTERNAL_AUTH_TOKEN."
        )


def _extract_token(
    x_internal_token: Optional[str],
    authorization: Optional[str],
) -> Optional[str]:
    if x_internal_token:
        return x_internal_token

    if authorization and authorization.lower().startswith("bearer "):
        return authorization[len("bearer "):].strip()

    return None


async def require_internal_token(
    x_internal_token: Optional[str] = Header(default=None, alias="X-Internal-Token"),
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
) -> None:
    """Dependency FastAPI que exige o token interno correto.

    Uso: aplicar via `dependencies=[Depends(require_internal_token)]` no
    router ou na rota. NAO aplicar em /health.
    """
    token = _extract_token(x_internal_token, authorization)

    if not token or token != settings.internal_auth_token:
        logger.warning("internal_auth_rejected", provided=bool(token))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid internal authentication token",
        )
