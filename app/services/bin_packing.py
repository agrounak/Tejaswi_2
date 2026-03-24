"""
Bin-packing algorithm for fitting rolls onto 3.2m shafts.
Uses First-Fit Decreasing heuristic to minimize trim loss.
"""
import math


def pack_rolls_into_shafts(roll_requests, shaft_width_mm=3200):
    """Pack roll requests into shafts using First-Fit Decreasing.

    Args:
        roll_requests: list of dicts with keys:
            - order_item_id: int
            - width_mm: float
            - rolls_needed: int
            - color: str
            - customer_name: str
            - gsm: float (optional)
            - quality_code: str (optional)
        shaft_width_mm: shaft capacity in mm (default 3200)

    Returns:
        list of shaft plans, each a dict with:
            - items: list of {order_item_id, width_mm, rolls_count, color, customer_name}
            - total_width_used: float
            - trim_loss: float
            - utilization_pct: float
    """
    # Expand each request into individual roll entries
    individual_rolls = []
    for req in roll_requests:
        for _ in range(req.get('rolls_needed', 1)):
            individual_rolls.append({
                'order_item_id': req['order_item_id'],
                'width_mm': req['width_mm'],
                'color': req.get('color', 'White'),
                'customer_name': req.get('customer_name', ''),
                'gsm': req.get('gsm'),
                'quality_code': req.get('quality_code'),
            })

    # Sort by width descending (First-Fit Decreasing)
    individual_rolls.sort(key=lambda r: r['width_mm'], reverse=True)

    shafts = []  # Each shaft: {remaining: float, items: list}

    for roll in individual_rolls:
        width = roll['width_mm']
        if width > shaft_width_mm:
            # Roll wider than shaft - still assign it (single roll)
            shafts.append({
                'remaining': 0,
                'items': [roll],
            })
            continue

        # Try to fit in existing shaft
        placed = False
        for shaft in shafts:
            if shaft['remaining'] >= width:
                shaft['items'].append(roll)
                shaft['remaining'] -= width
                placed = True
                break

        if not placed:
            # Open new shaft
            shafts.append({
                'remaining': shaft_width_mm - width,
                'items': [roll],
            })

    # Convert to output format - consolidate same order items on same shaft
    result = []
    for i, shaft in enumerate(shafts):
        consolidated = {}
        for item in shaft['items']:
            key = (item['order_item_id'], item['width_mm'], item['color'])
            if key in consolidated:
                consolidated[key]['rolls_count'] += 1
            else:
                consolidated[key] = {
                    'order_item_id': item['order_item_id'],
                    'width_mm': item['width_mm'],
                    'rolls_count': 1,
                    'color': item['color'],
                    'customer_name': item['customer_name'],
                    'gsm': item.get('gsm'),
                    'quality_code': item.get('quality_code'),
                }

        total_used = shaft_width_mm - shaft['remaining']
        trim_loss = shaft['remaining']

        result.append({
            'shaft_index': i + 1,
            'items': list(consolidated.values()),
            'total_width_used': round(total_used, 1),
            'trim_loss': round(trim_loss, 1),
            'utilization_pct': round((total_used / shaft_width_mm) * 100, 1),
        })

    return result


def optimize_by_color_grouping(roll_requests, shaft_width_mm=3200):
    """Pack rolls grouped by color first to minimize color changes.

    Groups rolls by color, then applies bin-packing within each group.
    """
    # Group by color
    color_groups = {}
    for req in roll_requests:
        color = req.get('color', 'White')
        if color not in color_groups:
            color_groups[color] = []
        color_groups[color].append(req)

    all_shafts = []
    for color, requests in color_groups.items():
        shafts = pack_rolls_into_shafts(requests, shaft_width_mm)
        all_shafts.extend(shafts)

    # Re-number shaft indices
    for i, shaft in enumerate(all_shafts):
        shaft['shaft_index'] = i + 1

    return all_shafts


def get_packing_summary(shaft_plans):
    """Get summary statistics for a set of shaft plans."""
    if not shaft_plans:
        return {
            'total_shafts': 0,
            'avg_utilization': 0,
            'total_trim_loss': 0,
            'total_rolls': 0,
        }

    total_rolls = sum(
        sum(item['rolls_count'] for item in shaft['items'])
        for shaft in shaft_plans
    )
    total_trim = sum(shaft['trim_loss'] for shaft in shaft_plans)
    avg_util = sum(shaft['utilization_pct'] for shaft in shaft_plans) / len(shaft_plans)

    return {
        'total_shafts': len(shaft_plans),
        'avg_utilization': round(avg_util, 1),
        'total_trim_loss': round(total_trim, 1),
        'total_rolls': total_rolls,
    }
