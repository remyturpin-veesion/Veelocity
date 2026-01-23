import pytest
from app.connectors.base import BaseConnector


def test_base_connector_cannot_be_instantiated():
    """BaseConnector is abstract and cannot be instantiated."""
    with pytest.raises(TypeError):
        BaseConnector()
