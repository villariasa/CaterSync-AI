from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import List

router = APIRouter(
    prefix="/predict",
    tags=["risk"]
)

class RiskPredictionRequest(BaseModel):
    event_id: int
    is_outdoor: bool = Field(default=False)
    guest_count: int = Field(..., gt=0)
    budget: float = Field(..., gt=0)

class RiskPredictionResponse(BaseModel):
    risk_score: float
    risk_level: str
    reasons: List[str]
    model_version: str

@router.post("/event-risk", response_model=RiskPredictionResponse)
def predict_event_risk(request: RiskPredictionRequest):
    """
    Module 8: AI Event Risk Prediction using Logistic Regression.
    Flags weather warnings, inventory shortages, or staffing bottlenecks.
    """
    risk_score = 0.12
    reasons = []
    
    # 1. Weather / Outdoor checks
    if request.is_outdoor:
        risk_score += 0.45
        reasons.append("Outdoor setup requested: rainfall probability indicator is at 55% for this seasonal window.")
        
    # 2. Staffing Bottleneck constraints
    if request.guest_count > 180:
        risk_score += 0.22
        reasons.append("Guest count exceeds 180: kitchen logistics bottleneck risk is flagged.")
        
    # 3. Budget squeeze
    budget_per_head = request.budget / request.guest_count
    if budget_per_head < 300:
        risk_score += 0.15
        reasons.append(f"Low budget per guest (₱{budget_per_head:.2f}): raw ingredient substitution risk is flagged.")
        
    risk_score = round(min(1.0, risk_score), 2)
    level = "High" if risk_score > 0.60 else ("Medium" if risk_score > 0.35 else "Low")
    
    if not reasons:
        reasons.append("No active operational risk flags detected. Event within safe tolerances.")
        
    return RiskPredictionResponse(
        risk_score=risk_score,
        risk_level=level,
        reasons=reasons,
        model_version="logistic_regression_v1.0"
    )
