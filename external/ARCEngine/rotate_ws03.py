import re
import ast

def rotate_position(match):
    x = int(match.group(1))
    y = int(match.group(2))
    # 90 degrees clockwise: (x, y) -> (h-1-y, x) -> (63-y, x)
    new_x = 63 - y
    new_y = x
    return f".set_position({new_x}, {new_y})"

def rotate_rotation(match):
    r = int(match.group(1))
    new_r = (r + 90) % 360
    return f".set_rotation({new_r})"

def rotate_val(val):
    try:
        if isinstance(val, list):
            return [rotate_val(v) for v in val]
        v = int(val)
        return (v + 90) % 360
    except:
        return val

def rotate_data_field(match, field_name):
    # match is the full key-value pair string like '"fij": 270' or '"opw": [90, 90]'
    full_str = match.group(0)
    key_part = f'"{field_name}":'
    if key_part not in full_str:
        return full_str
    
    val_str = full_str.split(key_part, 1)[1].strip().rstrip(',')
    
    try:
        val = ast.literal_eval(val_str)
        new_val = rotate_val(val)
        return f'"{field_name}": {new_val}'
    except:
        return full_str

def process_file():
    with open('games/official/ws03.py', 'r') as f:
        content = f.read()

    # Rotate positions in .set_position(x, y)
    content = re.sub(r'\.set_position\(\s*(\d+)\s*,\s*(\d+)\s*\)', rotate_position, content)
    
    # Rotate tuples in list comprehensions
    def rotate_tuples_list(match):
        list_str = match.group(1)
        try:
            # Use ast to safely parse the list of tuples
            tuples_list = ast.literal_eval(list_str)
            new_list = []
            for t in tuples_list:
                if isinstance(t, tuple) and len(t) == 2:
                    x, y = t
                    new_x = 63 - y
                    new_y = x
                    new_list.append((new_x, new_y))
                else:
                    new_list.append(t)
            # format compact list
            return str(new_list).replace(' ', '')
        except Exception as e:
            print(f"Failed to parse list: {e}")
            return match.group(0) # return original if fail

    content = re.sub(r'for x, y in (\[.*?\])', rotate_tuples_list, content, flags=re.DOTALL)

    # Rotate set_rotation
    content = re.sub(r'\.set_rotation\(\s*(\d+)\s*\)', rotate_rotation, content)

    # Rotate data fields
    def rotate_fij(match): return rotate_data_field(match, "fij")
    def rotate_opw(match): return rotate_data_field(match, "opw")
    
    content = re.sub(r'"fij":\s*(\[.*?\]|\d+)', rotate_fij, content)
    content = re.sub(r'"opw":\s*(\[.*?\]|\d+)', rotate_opw, content)

    with open('games/official/ws03.py', 'w') as f:
        f.write(content)

if __name__ == "__main__":
    process_file()
