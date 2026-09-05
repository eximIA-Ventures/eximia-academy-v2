"""Tests for CORS allow_origin_regex derived from APP_BASE_DOMAIN (D15)"""

import importlib

from fastapi.testclient import TestClient

from app import main as main_module
from app.config import settings


def _make_app_with_base_domain(monkeypatch, base_domain: str, environment: str = "production"):
    monkeypatch.setattr(settings, "app_base_domain", base_domain, raising=False)
    monkeypatch.setattr(settings, "environment", environment, raising=False)
    # internal_auth_token ja e customizado nos testes que usam producao
    monkeypatch.setattr(settings, "internal_auth_token", "token-forte-de-producao", raising=False)

    importlib.reload(main_module)
    return main_module.app


def test_cors_accepts_subdomain_of_base_domain(monkeypatch):
    app = _make_app_with_base_domain(monkeypatch, "academy.eximiaventures.com.br")
    client = TestClient(app)

    preflight = client.options(
        "/health",
        headers={
            "Origin": "https://cliente.academy.eximiaventures.com.br",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert preflight.headers.get("access-control-allow-origin") == (
        "https://cliente.academy.eximiaventures.com.br"
    )


def test_cors_rejects_other_domain(monkeypatch):
    app = _make_app_with_base_domain(monkeypatch, "academy.eximiaventures.com.br")
    client = TestClient(app)

    preflight = client.options(
        "/health",
        headers={
            "Origin": "https://malicioso.com",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert "access-control-allow-origin" not in {
        k.lower() for k in preflight.headers.keys()
    }
