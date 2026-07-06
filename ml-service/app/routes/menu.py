import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import pulp
from jinja2 import Environment, FileSystemLoader

router = APIRouter(
    prefix="/optimize",
    tags=["menu"]
)

class MenuOptimizationRequest(BaseModel):
    budget: float = Field(..., gt=0, description="Total budget for the event")
    guest_count: int = Field(..., gt=0, description="Total guest count")
    theme: str = Field(..., description="Theme style, e.g. Modern Elegant")

class MenuDetail(BaseModel):
    id: int
    name: str
    category: str
    cost_per_serving: float
    price_per_serving: float

class MenuOptimizationResponse(BaseModel):
    menu: MenuDetail
    description: str
    estCost: float
    estProfit: float
    margin: float

# Default menus to use if database is offline or empty
DEFAULT_MENUS = [
    {"id": 1, "name": "Classic Filipino Feast", "category": "Traditional", "cost_per_serving": 180.0, "price_per_serving": 450.0, "popularity": 95},
    {"id": 2, "name": "Premium Seafood Buffet", "category": "Seafood", "cost_per_serving": 320.0, "price_per_serving": 750.0, "popularity": 88},
    {"id": 3, "name": "Vegan Garden Delight", "category": "Vegetarian", "cost_per_serving": 120.0, "price_per_serving": 350.0, "popularity": 75},
    {"id": 4, "name": "Corporate Express Luncheon", "category": "Corporate", "cost_per_serving": 150.0, "price_per_serving": 400.0, "popularity": 80},
    {"id": 5, "name": "Western BBQ Social", "category": "Western", "cost_per_serving": 240.0, "price_per_serving": 600.0, "popularity": 90}
]

@router.post("/menu-generation", response_model=MenuOptimizationResponse)
def generate_menu(request: MenuOptimizationRequest):
    """
    Module 2: AI Menu Generator using Integer Linear Programming (PuLP)
    Maximizes menu popularity and profit margins while conforming to strict cost constraints.
    """
    budget_per_guest = request.budget / request.guest_count
    
    # Create the PuLP Optimization Problem
    # Since we want to select 1 menu, we formulate it as selecting a single menu index
    prob = pulp.LpProblem("Menu_Generator", pulp.LpMaximize)
    
    # Binary variables: x[i] = 1 if menu i is selected, 0 otherwise
    menu_vars = pulp.LpVariable.dicts("menu", [m["id"] for m in DEFAULT_MENUS], cat="Binary")
    
    # Constraint 1: Budget per serving must cover cost per serving
    # sum(x[i] * cost_per_serving[i]) <= budget_per_guest
    prob += pulp.lpSum([menu_vars[m["id"]] * m["cost_per_serving"] for m in DEFAULT_MENUS]) <= budget_per_guest
    
    # Constraint 2: Select exactly one menu
    prob += pulp.lpSum([menu_vars[m["id"]] for m in DEFAULT_MENUS]) == 1
    
    # Objective: Maximize popularity and price margin
    # popularity + margin
    prob += pulp.lpSum([
        menu_vars[m["id"]] * (m["popularity"] + (m["price_per_serving"] - m["cost_per_serving"]))
        for m in DEFAULT_MENUS
    ])
    
    # Solve the ILP
    status = prob.solve(pulp.PULP_CBC_CMD(msg=False))
    
    selected_menu = None
    if pulp.LpStatus[status] == "Optimal":
        for m in DEFAULT_MENUS:
            if pulp.value(menu_vars[m["id"]]) == 1:
                selected_menu = m
                break
                
    # Fallback to the cheapest menu if no optimal solution fits the budget limit
    if selected_menu is None:
        selected_menu = min(DEFAULT_MENUS, key=lambda x: x["cost_per_serving"])
        
    # Calculate financial projections
    est_cost = selected_menu["cost_per_serving"] * request.guest_count
    est_profit = (selected_menu["price_per_serving"] - selected_menu["cost_per_serving"]) * request.guest_count
    margin_pct = ((selected_menu["price_per_serving"] - selected_menu["cost_per_serving"]) / selected_menu["price_per_serving"]) * 100
    
    # Render explanation description using Jinja2 text templates
    templates_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "templates")
    
    try:
        env = Environment(loader=FileSystemLoader(templates_dir))
        template = env.get_template("menu_desc.txt")
        description = template.render(
            menu_name=selected_menu["name"],
            guest_count=request.guest_count,
            theme=request.theme,
            margin=int(margin_pct),
            est_cost=f"{int(est_cost):,}",
            est_profit=f"{int(est_profit):,}"
        )
    except Exception as e:
        # Simple backup string formatting if file template fetch fails
        description = f"Elegant {selected_menu['name']} for {request.guest_count} guests. Optimized for {request.theme} theme, maintaining a {int(margin_pct)}% margin."

    return MenuOptimizationResponse(
        menu=MenuDetail(
            id=selected_menu["id"],
            name=selected_menu["name"],
            category=selected_menu["category"],
            cost_per_serving=selected_menu["cost_per_serving"],
            price_per_serving=selected_menu["price_per_serving"]
        ),
        description=description,
        estCost=est_cost,
        estProfit=est_profit,
        margin=round(margin_pct, 1)
    )
