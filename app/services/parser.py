"""
Order text parser - extracts structured order items from unstructured text.
Handles formats like:
  "44 inch 2500 kg White"
  "46" 3000kg Ivory"
  "10/14 Dcut White 200kg"
"""
import re


INCH_TO_MM = 25.4

# Known colors for matching
KNOWN_COLORS = [
    'white', 'ivory', 'lemon yellow', 'lemon', 'golden yellow', 'gold',
    'red', 'blue', 'green', 'black', 'pink', 'orange', 'grey', 'gray',
    'brown', 'purple', 'maroon', 'cream', 'beige', 'yellow',
]

# Known quality codes
KNOWN_QUALITIES = ['dcut', 'd-cut', 'w-cut', 'wcut', 'u-cut', 'ucut', 'box bag', 'loop handle']


def parse_order_text(raw_text):
    """Parse unstructured order text into structured items.

    Returns a list of dicts with keys:
        width_inches, width_mm, weight_kg, gsm, color, quality_code
    """
    if not raw_text or not raw_text.strip():
        return []

    lines = raw_text.strip().split('\n')
    items = []
    current_color = None
    current_gsm = None
    current_quality = None

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Skip header-like lines (timestamps, names without numbers)
        if not re.search(r'\d', line):
            # Check if it's a color line
            color_match = _extract_color(line)
            if color_match:
                current_color = color_match
            # Check if quality code
            quality_match = _extract_quality(line)
            if quality_match:
                current_quality = quality_match
            continue

        # Try to extract width and weight from the line
        parsed = _parse_line(line)
        if parsed:
            # Apply current context if not found in line
            if not parsed.get('color') and current_color:
                parsed['color'] = current_color
            if not parsed.get('gsm') and current_gsm:
                parsed['gsm'] = current_gsm
            if not parsed.get('quality_code') and current_quality:
                parsed['quality_code'] = current_quality

            # Update context from this line
            if parsed.get('color'):
                current_color = parsed['color']
            if parsed.get('gsm'):
                current_gsm = parsed['gsm']
            if parsed.get('quality_code'):
                current_quality = parsed['quality_code']

            items.append(parsed)
        else:
            # Still try to update context
            color_match = _extract_color(line)
            if color_match:
                current_color = color_match
            gsm_match = _extract_gsm(line)
            if gsm_match:
                current_gsm = gsm_match
            quality_match = _extract_quality(line)
            if quality_match:
                current_quality = quality_match

    return items


def _parse_line(line):
    """Try to extract width, weight, color, gsm, quality from a single line."""
    result = {}

    # Extract width: patterns like "44 inch", "44\"", "44in", "44 in"
    width_match = re.search(
        r'(\d+\.?\d*)\s*(?:inch|inches|in|"|″|\'\')', line, re.IGNORECASE
    )
    if width_match:
        result['width_inches'] = float(width_match.group(1))
        result['width_mm'] = round(result['width_inches'] * INCH_TO_MM, 1)

    # Extract weight: patterns like "2500 kg", "2500kg", "2500 kgs"
    weight_match = re.search(
        r'(\d+\.?\d*)\s*(?:kg|kgs|kilogram|kilograms)', line, re.IGNORECASE
    )
    if weight_match:
        result['weight_kg'] = float(weight_match.group(1))

    # If we have neither width nor weight, this isn't an item line
    if 'width_inches' not in result and 'weight_kg' not in result:
        return None

    # Extract GSM: patterns like "GSM 40", "40 GSM", "10/14" (range)
    gsm_match = re.search(r'(\d+)\s*gsm', line, re.IGNORECASE)
    if gsm_match:
        result['gsm'] = float(gsm_match.group(1))
    else:
        gsm_match = re.search(r'gsm\s*(\d+)', line, re.IGNORECASE)
        if gsm_match:
            result['gsm'] = float(gsm_match.group(1))
        else:
            # Try slash format like "10/14" (take the second number as GSM)
            slash_match = re.search(r'(\d+)\s*/\s*(\d+)', line)
            if slash_match:
                result['gsm'] = float(slash_match.group(2))

    # Extract color
    color = _extract_color(line)
    if color:
        result['color'] = color

    # Extract quality
    quality = _extract_quality(line)
    if quality:
        result['quality_code'] = quality

    # Default color if not found
    if 'color' not in result:
        result['color'] = 'White'

    return result


def _extract_color(text):
    """Extract color name from text."""
    text_lower = text.lower()
    # Try multi-word colors first (longer matches)
    for color in sorted(KNOWN_COLORS, key=len, reverse=True):
        if color in text_lower:
            return color.title()
    return None


def _extract_gsm(text):
    """Extract GSM value from text."""
    match = re.search(r'(\d+)\s*gsm', text, re.IGNORECASE)
    if match:
        return float(match.group(1))
    match = re.search(r'gsm\s*(\d+)', text, re.IGNORECASE)
    if match:
        return float(match.group(1))
    return None


def _extract_quality(text):
    """Extract quality code from text."""
    text_lower = text.lower()
    for quality in KNOWN_QUALITIES:
        if quality in text_lower:
            return quality.replace('-', '').title()
    return None


def calculate_rolls_and_shafts(width_mm, weight_kg, gsm=None, shaft_width_mm=3200):
    """Calculate rolls needed and shaft usage for an order item.

    Args:
        width_mm: Roll width in mm
        weight_kg: Total weight needed in kg
        gsm: GSM of the material (if known)
        shaft_width_mm: Width of the shaft (default 3200mm = 3.2m)

    Returns:
        dict with rolls_per_shaft, rolls_needed, shafts_needed
    """
    if not width_mm or width_mm <= 0:
        return {'rolls_per_shaft': 0, 'rolls_needed': 0, 'shafts_needed': 0}

    # How many rolls fit side-by-side on one shaft
    rolls_per_shaft = int(shaft_width_mm // width_mm)
    if rolls_per_shaft < 1:
        rolls_per_shaft = 1

    # Estimate rolls needed from weight
    # Standard roll weight varies by GSM and width
    # Rough estimate: a standard roll weighs ~500kg for wide rolls, less for narrow
    if gsm and gsm > 0:
        # Approximate: roll weight depends on width, GSM, and standard length
        # Standard roll length ~1000m for light GSM, ~500m for heavy
        estimated_roll_weight = max(50, min(500, (width_mm / 1000) * gsm * 0.5))
    else:
        # Default estimate based on width
        estimated_roll_weight = max(50, min(500, width_mm * 0.3))

    rolls_needed = max(1, round(weight_kg / estimated_roll_weight))

    # How many shaft runs needed
    import math
    shafts_needed = math.ceil(rolls_needed / rolls_per_shaft)

    return {
        'rolls_per_shaft': rolls_per_shaft,
        'rolls_needed': rolls_needed,
        'shafts_needed': shafts_needed,
    }
