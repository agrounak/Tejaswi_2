from datetime import datetime, timedelta, timezone
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from app import db
from app.models import Order, OrderItem, ProductionRun, RunItem

dashboard_bp = Blueprint('dashboard', __name__)


@dashboard_bp.route('/summary', methods=['GET'])
@jwt_required()
def get_summary():
    """Dashboard summary KPIs."""
    try:
        total_orders = Order.query.count()
        pending_orders = Order.query.filter(Order.status == 'Pending').count()
        planned_orders = Order.query.filter(Order.status == 'Planned').count()
        completed_orders = Order.query.filter(Order.status == 'Completed').count()

        total_weight = db.session.query(
            db.func.coalesce(db.func.sum(OrderItem.weight_kg), 0)
        ).scalar()

        pending_weight = db.session.query(
            db.func.coalesce(db.func.sum(OrderItem.weight_kg), 0)
        ).join(Order).filter(Order.status.in_(['Pending', 'In Progress'])).scalar()

        total_runs = ProductionRun.query.count()
        planned_runs = ProductionRun.query.filter(ProductionRun.status == 'Planned').count()
        completed_runs = ProductionRun.query.filter(ProductionRun.status == 'Completed').count()

        # Average utilization
        avg_util = db.session.query(
            db.func.avg(
                ProductionRun.total_width_used_mm / 3200 * 100
            )
        ).filter(ProductionRun.total_width_used_mm > 0).scalar()

        return jsonify({
            'total_orders': total_orders,
            'pending_orders': pending_orders,
            'planned_orders': planned_orders,
            'completed_orders': completed_orders,
            'total_weight_kg': round(total_weight, 1),
            'pending_weight_kg': round(pending_weight, 1),
            'total_runs': total_runs,
            'planned_runs': planned_runs,
            'completed_runs': completed_runs,
            'avg_utilization': round(avg_util, 1) if avg_util else 0,
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@dashboard_bp.route('/analytics', methods=['GET'])
@jwt_required()
def get_analytics():
    """Analytics data for charts."""
    try:
        # Orders by status
        status_counts = db.session.query(
            Order.status, db.func.count(Order.id)
        ).group_by(Order.status).all()
        orders_by_status = [{'status': s, 'count': c} for s, c in status_counts]

        # Weight by color
        color_weights = db.session.query(
            OrderItem.color, db.func.sum(OrderItem.weight_kg)
        ).group_by(OrderItem.color).all()
        weight_by_color = [
            {'color': c or 'Unknown', 'weight': round(w, 1)}
            for c, w in color_weights if w
        ]

        # Weight by width
        width_weights = db.session.query(
            OrderItem.width_inches, db.func.sum(OrderItem.weight_kg)
        ).group_by(OrderItem.width_inches).order_by(OrderItem.width_inches).all()
        weight_by_width = [
            {'width': f'{w}"', 'weight': round(wt, 1)}
            for w, wt in width_weights if wt
        ]

        # Production runs by date (last 30 days)
        today = datetime.now(timezone.utc).date()
        thirty_days_ago = today - timedelta(days=30)
        runs_by_date = db.session.query(
            ProductionRun.run_date, db.func.count(ProductionRun.id)
        ).filter(
            ProductionRun.run_date >= thirty_days_ago
        ).group_by(ProductionRun.run_date).order_by(ProductionRun.run_date).all()
        production_trend = [
            {'date': d.isoformat(), 'count': c}
            for d, c in runs_by_date
        ]

        # Utilization distribution
        runs = ProductionRun.query.filter(ProductionRun.total_width_used_mm > 0).all()
        util_ranges = {'0-50%': 0, '50-75%': 0, '75-90%': 0, '90-100%': 0}
        for run in runs:
            pct = (run.total_width_used_mm / 3200) * 100
            if pct < 50:
                util_ranges['0-50%'] += 1
            elif pct < 75:
                util_ranges['50-75%'] += 1
            elif pct < 90:
                util_ranges['75-90%'] += 1
            else:
                util_ranges['90-100%'] += 1
        utilization_dist = [{'range': k, 'count': v} for k, v in util_ranges.items()]

        return jsonify({
            'orders_by_status': orders_by_status,
            'weight_by_color': weight_by_color,
            'weight_by_width': weight_by_width,
            'production_trend': production_trend,
            'utilization_distribution': utilization_dist,
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
