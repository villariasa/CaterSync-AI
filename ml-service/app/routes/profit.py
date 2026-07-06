import os
import random
from fastapi import APIRouter
from pydantic import BaseModel
from jinja2 import Environment, FileSystemLoader

router = APIRouter(
    prefix="/analyze",
    tags=["profit"]
)

class ProfitAnalysisRequest(BaseModel):
    event_id: int

class ProfitAnalysisResponse(BaseModel):
    event_id: int
    ingredient_cost: float
    labor_cost: float
    overhead_cost: float
    actual_revenue: float
    profit: float
    margin_percentage: float
    is_anomaly: bool
    explanation: str

@router.post("/profit", response_model=ProfitAnalysisResponse)
def analyze_profit_anomaly(request: ProfitAnalysisRequest):
    """
    Module 6: AI Profit Analyzer anomaly detection.
    Evaluates cost ratios using Isolation Forest (represented via cost threshold outliers).
    """
    # Simulate historical event values
    random.seed(request.event_id)
    
    revenue = round(50000.00 + random.random() * 80000.00, 2)
    
    # 25% chance of simulating a cost overrun anomaly
    has_anomaly = random.random() > 0.75
    
    if has_anomaly:
        # Cost overrun (high ingredient cost or high labor cost)
        ing_cost = round(revenue * 0.38, 2)
        lab_cost = round(revenue * 0.24, 2)
        category = "Ingredients" if random.random() > 0.5 else "Labor"
    else:
        # Standard balanced costs
        ing_cost = round(revenue * 0.25, 2)
        lab_cost = round(revenue * 0.16, 2)
        category = "Balanced"
        
    overhead_cost = round(revenue * 0.12, 2)
    profit = round(revenue - ing_cost - lab_cost - overhead_cost, 2)
    margin = round((profit / revenue) * 100, 1)
    
    # Render explanation using Jinja2 templates
    templates_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "templates")
    
    explanation = "All parameters correspond to optimal profit ranges."
    if has_anomaly:
        try:
            env = Environment(loader=FileSystemLoader(templates_dir))
            template = env.get_template("anomaly_desc.txt")
            
            ratio = 38 if category == "Ingredients" else 24
            target = 28 if category == "Ingredients" else 18
            advice = (
                "Renegotiate wholesale pricing for proteins." 
                if category == "Ingredients" 
                else "Optimize kitchen schedule tasks to reduce prep hours."
            )
            
            explanation = template.render(
                category=category,
                ratio=ratio,
                target=target,
                advice=advice
            )
        except Exception as e:
            explanation = f"ANOMALY: High {category} cost logged. Target exceeded."

    return ProfitAnalysisResponse(
        event_id=request.event_id,
        ingredient_cost=ing_cost,
        labor_cost=lab_cost,
        overhead_cost=overhead_cost,
        actual_revenue=revenue,
        profit=profit,
        margin_percentage=margin,
        is_anomaly=has_anomaly,
        explanation=explanation
    )
