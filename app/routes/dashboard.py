from datetime import datetime, timedelta, timezone
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from app import db
from app.models import Product, Dispatch

dashboard_bp = Blueprint('dashboard', __name__)


@dashboard_bp.route('/summary', methods=['GET'])
@jwt_required()
def get_summary():
    """Return dashboard summary stats."""
    try:
        today = datetime.now(timezone.utc).date()

        # Today's production count
        today_production = Product.query.filter(
            Product.production_date == today
        ).count()

        # Total stock
        stock_query = Product.query.filter(
            Product.status.in_(['In Warehouse', 'Sticker Printed'])
        )
        total_stock = stock_query.count()

        total_stock_weight = db.session.query(
            db.func.coalesce(db.func.sum(Product.net_weight), 0)
        ).filter(
            Product.status.in_(['In Warehouse', 'Sticker Printed'])
        ).scalar()

        # Active dispatches
        active_dispatches = Dispatch.query.filter(
            Dispatch.status != 'Dispatched'
        ).count()

        # Dispatched today
        dispatched_today = Product.query.filter(
            Product.status == 'Dispatched',
            Product.production_date == today
        ).count()

        # Also count dispatches finalized today
        dispatches_finalized_today = Dispatch.query.filter(
            Dispatch.status == 'Dispatched',
            db.func.date(Dispatch.created_at) == today
        ).count()

        return jsonify({
            'today_production': today_production,
            'total_stock': total_stock,
            'total_stock_weight': round(total_stock_weight, 2),
            'active_dispatches': active_dispatches,
            'dispatched_today': dispatched_today,
            'dispatches_finalized_today': dispatches_finalized_today,
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@dashboard_bp.route('/analytics', methods=['GET'])
@jwt_required()
def get_analytics():
    """Return analytics data for charts."""
    try:
        today = datetime.now(timezone.utc).date()
        thirty_days_ago = today - timedelta(days=30)

        # Production by shift
        production_by_shift = db.session.query(
            Product.shift,
            db.func.count(Product.id)
        ).group_by(Product.shift).all()

        production_by_shift_data = [
            {'shift': row[0], 'count': row[1]}
            for row in production_by_shift
        ]

        # Production trend (last 30 days)
        production_trend_rows = db.session.query(
            Product.production_date,
            db.func.count(Product.id)
        ).filter(
            Product.production_date >= thirty_days_ago
        ).group_by(
            Product.production_date
        ).order_by(
            Product.production_date
        ).all()

        production_trend = [
            {'date': row[0].isoformat(), 'count': row[1]}
            for row in production_trend_rows
        ]

        # Dispatch trend (last 30 days)
        dispatch_trend_rows = db.session.query(
            Dispatch.dispatch_date,
            db.func.count(Dispatch.id)
        ).filter(
            Dispatch.status == 'Dispatched',
            Dispatch.dispatch_date >= thirty_days_ago
        ).group_by(
            Dispatch.dispatch_date
        ).order_by(
            Dispatch.dispatch_date
        ).all()

        dispatch_trend = [
            {'date': row[0].isoformat() if row[0] else None, 'count': row[1]}
            for row in dispatch_trend_rows
        ]

        # Inventory by type
        inventory_by_type_rows = db.session.query(
            Product.product_type,
            db.func.count(Product.id),
            db.func.coalesce(db.func.sum(Product.net_weight), 0)
        ).filter(
            Product.status.in_(['In Warehouse', 'Sticker Printed'])
        ).group_by(
            Product.product_type
        ).all()

        inventory_by_type = [
            {
                'product_type': row[0],
                'count': row[1],
                'total_weight': round(row[2], 2)
            }
            for row in inventory_by_type_rows
        ]

        return jsonify({
            'production_by_shift': production_by_shift_data,
            'production_trend': production_trend,
            'dispatch_trend': dispatch_trend,
            'inventory_by_type': inventory_by_type,
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
