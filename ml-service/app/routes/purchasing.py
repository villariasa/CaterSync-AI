import math
from typing import List, Optional
from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(
    prefix="/optimize",
    tags=["purchasing"]
)

class IngredientInput(BaseModel):
    id: int
    name: str
    unit: str
    current_stock: float
    reorder_point: float
    shelf_life_days: int
    weekly_demand: float
    unit_cost: float
    supplier_prices: List[dict] = Field(default=[], description="List of dicts: [{'supplier_id': 1, 'name': 'S1', 'price': 100, 'lead_time': 2, 'reliability': 0.95}]")

class RestockSuggestion(BaseModel):
    ingredient_id: int
    name: str
    suggested_order_qty: float
    unit: str
    recommended_supplier_id: int
    recommended_supplier_name: str
    estimated_cost: float
    lead_time_days: int
    order_by_date_offset_days: int
    stock_status: str

class PurchasingOptimizationResponse(BaseModel):
    suggestions: List[RestockSuggestion]
    total_estimated_spend: float

@router.post("/ingredient-purchasing", response_model=PurchasingOptimizationResponse)
def optimize_purchasing(ingredients: List[IngredientInput]):
    """
    Module 3: Economical Order Quantity (EOQ) + Greedy Supplier Selection solver.
    Outputs the optimized restock quantities and suppliers.
    """
    suggestions = []
    total_spend = 0.0
    
    # Standard constant costs for EOQ formula
    ORDER_SETUP_COST = 250.00  # Fixed admin cost per order
    ANNUAL_HOLDING_COST_PCT = 0.18 # 18% of item unit cost per year
    
    for ing in ingredients:
        daily_demand = ing.weekly_demand / 7.0
        annual_demand = ing.weekly_demand * 52.0
        
        # Determine if restocking is needed
        stock_deficit = ing.reorder_point - ing.current_stock
        is_low = ing.current_stock <= ing.reorder_point
        
        # Calculate EOQ: sqrt((2 * Demand * OrderCost) / HoldingCost)
        holding_cost_annual = max(1.0, ing.unit_cost * ANNUAL_HOLDING_COST_PCT)
        eoq = math.sqrt((2 * annual_demand * ORDER_SETUP_COST) / holding_cost_annual)
        
        # Adjust for shelf life constraint (avoid decay)
        max_freshness_qty = daily_demand * ing.shelf_life_days
        suggested_qty = eoq
        
        # Shelf life caps the maximum order size
        if suggested_qty > max_freshness_qty:
            suggested_qty = max_freshness_qty
            
        # Ensure we order at least enough to cover deficit plus safety stock
        safety_stock = daily_demand * 3 # 3 days buffer
        min_order = max(0.0, stock_deficit + safety_stock)
        suggested_qty = max(suggested_qty, min_order)
        
        # Rounded suggestions
        suggested_qty = round(suggested_qty, 2)
        
        # If no demand and stock is fine, skip or set order to 0
        if not is_low and suggested_qty < min_order:
            continue
            
        if suggested_qty <= 0.1:
            continue
            
        # Greedy Supplier Selection:
        # Score suppliers based on combination of price (lowest) and reliability (highest)
        best_supplier = None
        best_score = -100000.0
        
        for sp in ing.supplier_prices:
            # Score formula: Reliability / (Price * LeadTimeFactor)
            # We want high reliability, low price, low lead time.
            price = float(sp.get('price', ing.unit_cost))
            lead_time = max(1, int(sp.get('lead_time', 2)))
            reliability = float(sp.get('reliability', 0.90))
            
            # Simple scoring: higher reliability and lower price is better
            score = (reliability * 100.0) - (price * 0.1) - (lead_time * 2.0)
            
            if score > best_score:
                best_score = score
                best_supplier = sp
                
        # Fallback if no suppliers listed
        if best_supplier is None:
            rec_id = 1
            rec_name = "Primary Wholesaler"
            price = ing.unit_cost
            lead_time = 2
        else:
            rec_id = best_supplier.get('supplier_id', 1)
            rec_name = best_supplier.get('name', 'Recommended Vendor')
            price = float(best_supplier.get('price', ing.unit_cost))
            lead_time = int(best_supplier.get('lead_time', 2))
            
        est_cost = round(suggested_qty * price, 2)
        total_spend += est_cost
        
        # Calculate when to order (order buffer before stockouts occur)
        days_until_out = 99
        if daily_demand > 0:
            days_until_out = int(ing.current_stock / daily_demand)
            
        order_offset = max(0, days_until_out - lead_time)
        
        status_label = "CRITICAL" if ing.current_stock <= (ing.reorder_point * 0.5) else "WARNING"
        
        suggestions.append(RestockSuggestion(
            ingredient_id=ing.id,
            name=ing.name,
            suggested_order_qty=suggested_qty,
            unit=ing.unit,
            recommended_supplier_id=rec_id,
            recommended_supplier_name=rec_name,
            estimated_cost=est_cost,
            lead_time_days=lead_time,
            order_by_date_offset_days=order_offset,
            stock_status=status_label
        ))
        
    return PurchasingOptimizationResponse(
        suggestions=suggestions,
        total_estimated_spend=round(total_spend, 2)
    )
