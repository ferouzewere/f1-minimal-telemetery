import pytest
from httpx import AsyncClient
from apps.bridge.main import app

@pytest.mark.asyncio
async def test_read_status():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/status")
    assert response.status_code == 200
    assert response.json() == {"status": "online", "service": "f1-telemetry-bridge"}
