"""Shared test fixtures for Revenue Copilot Engine."""

import pytest


@pytest.fixture
def sample_tenant_id() -> str:
    """Provide a sample tenant ID for testing."""
    return "tenant_test_001"
