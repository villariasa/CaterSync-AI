from fastapi.testclient import TestClient
import sys
import os

# Add parent app directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "CaterSync AI Inference Service"}

def test_predict_quantity():
    payload = {
        "guest_count": 120,
        "event_type": "Wedding",
        "theme": "Modern Elegant",
        "is_outdoor": True
    }
    response = client.post("/api/v1/predict/food-quantity", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "predicted_qty_kg" in data
    assert data["predicted_qty_kg"] > 0
    assert "confidence_lower_kg" in data

def test_optimize_menu():
    payload = {
        "budget": 60000,
        "guest_count": 150,
        "theme": "Modern Elegant"
    }
    response = client.post("/api/v1/optimize/menu-generation", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "menu" in data
    assert "description" in data
    assert "margin" in data

def test_optimize_purchasing():
    payload = [
        {
            "id": 1,
            "name": "Chicken Breast",
            "unit": "kg",
            "current_stock": 10.0,
            "reorder_point": 30.0,
            "shelf_life_days": 5,
            "weekly_demand": 70.0,
            "unit_cost": 180.0,
            "supplier_prices": [
                {"supplier_id": 1, "name": "Vendor A", "price": 175.0, "lead_time": 2, "reliability": 0.95}
            ]
        }
    ]
    response = client.post("/api/v1/optimize/ingredient-purchasing", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "suggestions" in data
    assert len(data["suggestions"]) > 0

def test_kitchen_schedule():
    payload = {
        "event_id": 48,
        "menu_items": ["Adobo", "Rice"],
        "staff_count": 3
    }
    response = client.post("/api/v1/optimize/kitchen-schedule", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0
    assert "task" in data[0]

def test_staff_assignment():
    payload = {
        "event_id": 48,
        "guest_count": 120,
        "complexity_score": 1.2
    }
    response = client.post("/api/v1/optimize/staff-assignment", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0
    assert "staff_name" in data[0]

def test_profit_anomaly():
    payload = {
        "event_id": 12
    }
    response = client.post("/api/v1/analyze/profit", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "is_anomaly" in data
    assert "explanation" in data

def test_customer_preferences():
    payload = {
        "customer_id": 7
    }
    response = client.post("/api/v1/recommend/customer-preferences", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0
    assert "match_score" in data[0]

def test_sales_forecast():
    response = client.get("/api/v1/predict/sales-forecast")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 12
    assert "predicted_revenue" in data[0]
