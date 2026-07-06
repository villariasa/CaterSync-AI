from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List
from ortools.sat.python import cp_model

router = APIRouter(
    prefix="/optimize",
    tags=["scheduler"]
)

class KitchenScheduleRequest(BaseModel):
    event_id: int = Field(..., description="Event identifier")
    menu_items: List[str] = Field(default=["Adobo", "Rice", "Sinigang"], description="List of dishes to prepare")
    staff_count: int = Field(default=3, description="Available kitchen staff count")

class ScheduledTask(BaseModel):
    task: str
    time: str
    staff: str
    duration: str

@router.post("/kitchen-schedule", response_model=List[ScheduledTask])
def solve_kitchen_schedule(request: KitchenScheduleRequest):
    """
    Module 4: AI Kitchen Scheduler using Google OR-Tools CP-SAT Solver.
    Solves Job-Shop scheduling problem minimizing total prep duration (makespan).
    """
    model = cp_model.CpModel()
    
    # Simple Job Shop definition: 4 tasks with precedence relationships:
    # 1. Prep (Duration: 60m) -> 2. Cooking (Duration: 120m) -> 3. Portioning (Duration: 30m) -> 4. Loading (Duration: 45m)
    # Resources: 2 chefs (Chef A, Chef B)
    
    # Task intervals
    horizon = 360 # 6 hours total window
    
    # Define variables
    start_prep = model.NewIntVar(0, horizon, 'start_prep')
    end_prep = model.NewIntVar(0, horizon, 'end_prep')
    duration_prep = 60
    interval_prep = model.NewIntervalVar(start_prep, duration_prep, end_prep, 'interval_prep')
    
    start_cook = model.NewIntVar(0, horizon, 'start_cook')
    end_cook = model.NewIntVar(0, horizon, 'end_cook')
    duration_cook = 120
    interval_cook = model.NewIntervalVar(start_cook, duration_cook, end_cook, 'interval_cook')
    
    start_pkg = model.NewIntVar(0, horizon, 'start_pkg')
    end_pkg = model.NewIntVar(0, horizon, 'end_pkg')
    duration_pkg = 30
    interval_pkg = model.NewIntervalVar(start_pkg, duration_pkg, end_pkg, 'interval_pkg')
    
    start_load = model.NewIntVar(0, horizon, 'start_load')
    end_load = model.NewIntVar(0, horizon, 'end_load')
    duration_load = 45
    interval_load = model.NewIntervalVar(start_load, duration_load, end_load, 'interval_load')
    
    # Precedence Constraints: Prep -> Cook -> Port -> Load
    model.Add(end_prep <= start_cook)
    model.Add(end_cook <= start_pkg)
    model.Add(end_pkg <= start_load)
    
    # Resource Constraints: Chef A handles Prep and Cook. Chef B handles Port and Load.
    # Therefore, no resource overlap occurs in this simple configuration, but in a real CP-SAT solver,
    # we add NoOverlap constraint for shared resources:
    # model.AddNoOverlap([interval_prep, interval_cook]) # If Chef A does both
    
    # Objective: Minimize makespan (end of last task)
    obj_var = model.NewIntVar(0, horizon, 'makespan')
    model.AddMaxEquality(obj_var, [end_load])
    model.Minimize(obj_var)
    
    # Solve
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 2.0
    status = solver.Solve(model)
    
    timeline = []
    if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
        # Base offset time: 08:00 AM
        base_time = datetime(2026, 7, 6, 8, 0)
        
        def format_time(minutes):
            t = base_time + timedelta(minutes=int(minutes))
            return t.strftime("%I:%M %p")
            
        timeline = [
            ScheduledTask(
                task="Ingredient Prep & Chopping",
                time=format_time(solver.Value(start_prep)),
                staff="Anna Reyes (Sous Chef)",
                duration=f"{duration_prep} mins"
            ),
            ScheduledTask(
                task=f"Cooking Core Menu ({', '.join(request.menu_items)})",
                time=format_time(solver.Value(start_cook)),
                staff="Juan Cruz (Head Chef)",
                duration=f"{duration_cook} mins"
            ),
            ScheduledTask(
                task="Portioning & Vacuum Packing",
                time=format_time(solver.Value(start_pkg)),
                staff="Pedro Gomez (Sous Chef)",
                duration=f"{duration_pkg} mins"
            ),
            ScheduledTask(
                task="Logistics Loading & Transportation",
                time=format_time(solver.Value(start_load)),
                staff="Sarah Lim (Coordinator)",
                duration=f"{duration_load} mins"
            )
        ]
    else:
        # Static fallback if solver fails
        timeline = [
            ScheduledTask(task="Ingredient Prep & Chopping", time="08:00 AM", staff="Anna Reyes", duration="60 mins"),
            ScheduledTask(task="Cooking Core Menu", time="09:00 AM", staff="Juan Cruz", duration="120 mins"),
            ScheduledTask(task="Portioning & Packing", time="11:00 AM", staff="Pedro Gomez", duration="30 mins"),
            ScheduledTask(task="Logistics Loading", time="11:30 AM", staff="Sarah Lim", duration="45 mins")
        ]
        
    return timeline

from datetime import datetime, timedelta
