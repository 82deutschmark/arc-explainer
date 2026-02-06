import re
import ast

def rotate_pixels_90_cw(pixels):
    # Transpose and reverse rows for 90 CW rotation
    # list(zip(*pixels[::-1]))
    # But we need to handle the fact that pixels is a list of lists
    return [list(row) for row in zip(*pixels[::-1])]

def update_rotation_value(match):
    r = int(match.group(1))
    new_r = (r - 90) % 360
    return f".set_rotation({new_r})"

def update_data_value(val):
    try:
        if isinstance(val, list):
            return [update_data_value(v) for v in val]
        v = int(val)
        return (v - 90) % 360
    except:
        return val

def update_data_field(match, field_name):
    full_str = match.group(0)
    key_part = f'"{field_name}":'
    if key_part not in full_str:
        return full_str
    
    val_str = full_str.split(key_part, 1)[1].strip().rstrip(',')
    
    try:
        val = ast.literal_eval(val_str)
        new_val = update_data_value(val)
        return f'"{field_name}": {new_val}'
    except:
        return full_str

def process_file():
    with open('games/official/ws03.py', 'r') as f:
        content = f.read()

    # 1. Rotate sprite pixels (excluding mgu which was already rotated)
    # Find all sprite definitions
    def rotate_sprite_pixels(match):
        name = match.group(1)
        pixels_str = match.group(2)
        
        if name == "mgu":
            # Skip mgu as it was already rotated
            return match.group(0)
            
        try:
            pixels = ast.literal_eval(pixels_str)
            rotated = rotate_pixels_90_cw(pixels)
            return f'"{name}": Sprite(pixels={rotated}'
        except Exception as e:
            print(f"Error rotating {name}: {e}")
            return match.group(0)

    # Regex to match sprite definitions: "name": Sprite(pixels=[...],
    # We use non-greedy matching for pixels
    content = re.sub(r'"(\w+)":\s*Sprite\(pixels=(\[.*?\])', rotate_sprite_pixels, content, flags=re.DOTALL)

    # 2. Revert set_rotation values (subtract 90)
    content = re.sub(r'\.set_rotation\(\s*(\d+)\s*\)', update_rotation_value, content)

    # 3. Revert data fields (fij, opw)
    def fix_fij(match): return update_data_field(match, "fij")
    def fix_opw(match): return update_data_field(match, "opw")
    
    content = re.sub(r'"fij":\s*(\[.*?\]|\d+)', fix_fij, content)
    content = re.sub(r'"opw":\s*(\[.*?\]|\d+)', fix_opw, content)

    with open('games/official/ws03.py', 'w') as f:
        f.write(content)

if __name__ == "__main__":
    process_file()
