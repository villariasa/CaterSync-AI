def compact_phone_number(value):
    return "".join(char for char in value if char.isdigit() or char == "+")
