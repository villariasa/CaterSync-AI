from fastapi import APIRouter
from pydantic import BaseModel
from typing import List

router = APIRouter(
    prefix="/recommend",
    tags=["recommender"]
)

class PreferenceRequest(BaseModel):
    customer_id: int

class RecommendedMenu(BaseModel):
    menu_id: int
    name: str
    category: str
    match_score: float

# Default menu list
MENUS = [
    {"id": 1, "name": "Classic Filipino Feast", "category": "Traditional"},
    {"id": 2, "name": "Premium Seafood Buffet", "category": "Seafood"},
    {"id": 3, "name": "Vegan Garden Delight", "category": "Vegetarian"},
    {"id": 4, "name": "Corporate Express Luncheon", "category": "Corporate"}
]

@router.post("/customer-preferences", response_model=List[RecommendedMenu])
def recommend_preferences(request: PreferenceRequest):
    """
    Module 7: AI Customer Preference Learning.
    Returns cosine-similarity ranked recommendations.
    """
    recommendations = []
    
    # Simulate matching based on customer ID parity
    # Even ID prefers Seafood, Odd prefers traditional
    for m in MENUS:
        score = 0.30
        
        if request.customer_id % 2 == 0 and m["category"] == "Seafood":
            score += 0.55
        elif request.customer_id % 2 != 0 and m["category"] == "Traditional":
            score += 0.50
        elif request.customer_id % 3 == 0 and m["category"] == "Vegetarian":
            score += 0.40
            
        recommendations.append(RecommendedMenu(
            menu_id=m["id"],
            name=m["name"],
            category=m["category"],
            match_score=round(score, 2)
        ))
        
    return sorted(recommendations, key=lambda x: x.match_score, reverse=True)
