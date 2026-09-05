"""Tests for internal authentication (D15)"""

import importlib

import pytest


def test_generate_without_token_is_rejected(client, sample_blueprint_request):
    """Sem header de auth, requisicao deve ser recusada com 401"""
    response = client.post("/blueprint/generate", json=sample_blueprint_request)

    assert response.status_code == 401


def test_generate_with_wrong_token_is_rejected(client, sample_blueprint_request):
    """Token errado deve ser recusado com 401"""
    response = client.post(
        "/blueprint/generate",
        json=sample_blueprint_request,
        headers={"X-Internal-Token": "token-errado"},
    )

    assert response.status_code == 401


def test_generate_with_wrong_bearer_token_is_rejected(client, sample_blueprint_request):
    """Authorization: Bearer com token errado tambem deve ser recusado"""
    response = client.post(
        "/blueprint/generate",
        json=sample_blueprint_request,
        headers={"Authorization": "Bearer token-errado"},
    )

    assert response.status_code == 401


def test_generate_with_correct_token_passes(client, auth_headers, sample_blueprint_request):
    """Token correto via X-Internal-Token deve passar"""
    response = client.post(
        "/blueprint/generate",
        json=sample_blueprint_request,
        headers=auth_headers,
    )

    assert response.status_code == 200


def test_generate_with_correct_bearer_token_passes(client, sample_blueprint_request):
    """Token correto via Authorization: Bearer deve passar"""
    from app.config import settings

    response = client.post(
        "/blueprint/generate",
        json=sample_blueprint_request,
        headers={"Authorization": f"Bearer {settings.internal_auth_token}"},
    )

    assert response.status_code == 200


def test_health_does_not_require_token(client):
    """/health deve responder 200 mesmo sem nenhum header de auth"""
    response = client.get("/health")

    assert response.status_code == 200


def test_root_requires_token(client):
    """A raiz '/' tambem exige o token interno"""
    response = client.get("/")

    assert response.status_code == 401


def test_startup_fails_closed_with_default_token_in_production(monkeypatch):
    """Em producao, subir com o token padrao deve falhar de forma explicita"""
    from app import auth

    monkeypatch.setattr(auth.settings, "environment", "production", raising=False)
    monkeypatch.setattr(auth.settings, "internal_auth_token", auth.DEFAULT_DEV_TOKEN, raising=False)

    with pytest.raises(RuntimeError):
        auth.validate_startup_auth_config()


def test_startup_passes_with_custom_token_in_production(monkeypatch):
    """Em producao, com token customizado, o startup nao deve falhar"""
    from app import auth

    monkeypatch.setattr(auth.settings, "environment", "production", raising=False)
    monkeypatch.setattr(auth.settings, "internal_auth_token", "token-forte-de-producao", raising=False)

    auth.validate_startup_auth_config()  # nao deve levantar excecao
