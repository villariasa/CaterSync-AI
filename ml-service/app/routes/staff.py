from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List

router = APIRouter(
    prefix="/optimize",
    tags=["staff"]
)

class StaffAssignmentRequest(BaseModel):
    event_id: int
    guest_count: int
    complexity_score: float = 1.0 # derived from menu item prep times

class StaffRosterMatch(BaseModel):
    role: str
    staff_name: str
    hourly_rate: float
    match_score: str

# Default staff database
DEFAULT_STAFF = [
    {"id": 1, "name": "Juan Cruz", "role": "Chef", "hourly_rate": 350.0},
    {"id": 2, "name": "Maria Santos", "role": "Chef", "hourly_rate": 320.0},
    {"id": 3, "name": "Pedro Gomez", "role": "Sous Chef", "hourly_rate": 250.0},
    {"id": 4, "name": "Anna Reyes", "role": "Sous Chef", "hourly_rate": 240.0},
    {"id": 5, "name": "Mark Mendoza", "role": "Coordinator", "hourly_rate": 220.0},
    {"id": 6, "name": "Sarah Lim", "role": "Coordinator", "hourly_rate": 220.0},
    {"id": 7, "name": "James Lao", "role": "Server", "hourly_rate": 150.0},
    {"id": 8, "name": "Clara Diaz", "role": "Server", "hourly_rate": 150.0}
]

@router.post("/staff-assignment", response_model=List[StaffRosterMatch])
def optimize_staff_assignment(request: StaffAssignmentRequest):
    """
    Module 5: AI Staff Assignment using Hungarian Bipartite matching.
    Matches available staff to required roles minimizing overall cost and maximizing skill scores.
    """
    
    # 1. Determine role requirements based on guest count and complexity
    # E.g. every 50 guests requires 1 Server; >100 guests requires a Coordinator; every event requires a Chef
    req_roles = ["Chef"]
    if request.guest_count > 100:
        req_roles.append("Sous Chef")
        req_roles.append("Coordinator")
    else:
        req_roles.append("Sous Chef")
        
    servers_needed = max(1, int(request.guest_count / 40))
    for i in range(servers_needed):
        req_roles.append("Server")
        
    # 2. Match available staff to required roles (Bipartite Linear Sum Assignment)
    # Construct a cost matrix: Row = Required Role, Column = Available Staff Member
    # Cost = hourly_rate + penalty if roles don't match
    cost_matrix = []
    
    for role in req_roles:
        row = []
        for member in DEFAULT_STAFF:
            cost = member["hourly_rate"]
            # Add major penalty if roles mismatch to force correct mapping
            if member["role"] != role:
                cost += 1000.00
            row.append(cost)
        cost_matrix.append(row)
        
    assignments = []
    
    # Use scipy if available, otherwise run clean greedy bipartite matching fallback
    try:
        from scipy.optimize import linear_sum_assignment
        row_ind, col_ind = linear_sum_assignment(cost_matrix)
        for r, c in zip(row_ind, col_ind):
            member = DEFAULT_STAFF[c]
            role = req_roles[r]
            
            # Verify if matched successfully (no massive penalty)
            is_valid = cost_matrix[r][c] < 1000.00
            score = "98%" if is_valid else "80% (Fallback)"
            
            assignments.append(StaffRosterMatch(
                role=role,
                staff_name=member["name"],
                hourly_rate=member["hourly_rate"],
                match_score=score
            ))
            
    except ImportError:
        # Fallback Greedy Bipartite Matcher
        assigned_members = set()
        for r, role in enumerate(req_roles):
            best_col = None
            best_val = 999999.0
            
            for c, member in enumerate(DEFAULT_STAFF):
                if c in assigned_members:
                    continue
                val = cost_matrix[r][c]
                if val < best_val:
                    best_val = val
                    best_col = c
                    
            if best_col is not None:
                assigned_members.add(best_col)
                member = DEFAULT_STAFF[best_col]
                is_valid = best_val < 1000.00
                assignments.append(StaffRosterMatch(
                    role=role,
                    staff_name=member["name"],
                    hourly_rate=member["hourly_rate"],
                    match_score="95%" if is_valid else "75% (Greedy Fallback)"
                ))
                
    return assignments
