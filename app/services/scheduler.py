"""
Production scheduler - assigns shaft plans to dates based on priority.
"""
from datetime import datetime, timedelta, timezone


def schedule_production(shaft_plans, start_date=None, max_shafts_per_day=10):
    """Assign shaft plans to production dates.

    Args:
        shaft_plans: list of shaft plans from bin_packing
        start_date: first available production date (default: tomorrow)
        max_shafts_per_day: maximum number of shaft runs per day

    Returns:
        list of scheduled runs with assigned dates
    """
    if not shaft_plans:
        return []

    if start_date is None:
        start_date = datetime.now(timezone.utc).date() + timedelta(days=1)
    elif isinstance(start_date, str):
        start_date = datetime.strptime(start_date, '%Y-%m-%d').date()

    scheduled = []
    current_date = start_date
    day_count = 0

    for i, shaft in enumerate(shaft_plans):
        if day_count >= max_shafts_per_day:
            current_date += timedelta(days=1)
            # Skip weekends
            while current_date.weekday() >= 6:  # Sunday
                current_date += timedelta(days=1)
            day_count = 0

        scheduled.append({
            **shaft,
            'run_date': current_date.isoformat(),
            'shaft_number': day_count + 1,
        })
        day_count += 1

    return scheduled


def prioritize_orders(orders):
    """Sort orders by priority for scheduling.

    Priority rules:
    1. Orders with due dates come first (sorted by due date)
    2. Orders without due dates come next (sorted by order date)
    """
    with_due = [o for o in orders if o.get('due_date')]
    without_due = [o for o in orders if not o.get('due_date')]

    with_due.sort(key=lambda o: o['due_date'])
    without_due.sort(key=lambda o: o.get('order_date', '9999-12-31'))

    return with_due + without_due
