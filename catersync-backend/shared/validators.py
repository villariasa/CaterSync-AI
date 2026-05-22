def require_positive(value, field_name="value"):
    if value <= 0:
        raise ValueError(f"{field_name} must be positive.")
