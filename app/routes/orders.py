from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app import db
from app.models import Order, OrderItem, Config
from app.services.parser import parse_order_text, calculate_rolls_and_shafts

orders_bp = Blueprint('orders', __name__)

SHAFT_WIDTH_MM = 3200


@orders_bp.route('', methods=['POST'])
@jwt_required()
def create_order():
    """Create an order from structured data or parse from raw text."""
    try:
        data = request.get_json()
        customer_name = data.get('customer_name')
        if not customer_name:
            return jsonify({'error': 'Customer name is required'}), 400

        order = Order(
            customer_name=customer_name,
            due_date=datetime.strptime(data['due_date'], '%Y-%m-%d').date() if data.get('due_date') else None,
            notes=data.get('notes'),
            raw_text=data.get('raw_text'),
            status='Pending',
        )

        # If raw_text provided, parse it
        raw_text = data.get('raw_text')
        items_data = data.get('items', [])

        if raw_text and not items_data:
            items_data = parse_order_text(raw_text)

        for item_data in items_data:
            width_inches = item_data.get('width_inches', 0)
            width_mm = item_data.get('width_mm', round(width_inches * 25.4, 1))
            weight_kg = item_data.get('weight_kg', 0)
            gsm = item_data.get('gsm')

            if not width_inches and width_mm:
                width_inches = round(width_mm / 25.4, 1)
            if not width_mm and width_inches:
                width_mm = round(width_inches * 25.4, 1)

            calc = calculate_rolls_and_shafts(width_mm, weight_kg, gsm, SHAFT_WIDTH_MM)

            order_item = OrderItem(
                width_inches=width_inches,
                width_mm=width_mm,
                weight_kg=weight_kg,
                gsm=gsm,
                color=item_data.get('color', 'White'),
                quality_code=item_data.get('quality_code'),
                rolls_needed=calc['rolls_needed'],
                rolls_per_shaft=calc['rolls_per_shaft'],
                shafts_needed=calc['shafts_needed'],
            )
            order.items.append(order_item)

        db.session.add(order)
        db.session.commit()
        return jsonify({'order': order.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@orders_bp.route('/parse', methods=['POST'])
@jwt_required()
def parse_text():
    """Parse raw order text and return structured items (preview, no save)."""
    try:
        data = request.get_json()
        raw_text = data.get('raw_text', '')
        items = parse_order_text(raw_text)

        # Add roll calculations
        for item in items:
            width_mm = item.get('width_mm', 0)
            weight_kg = item.get('weight_kg', 0)
            gsm = item.get('gsm')
            calc = calculate_rolls_and_shafts(width_mm, weight_kg, gsm, SHAFT_WIDTH_MM)
            item.update(calc)

        return jsonify({'items': items, 'count': len(items)}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@orders_bp.route('', methods=['GET'])
@jwt_required()
def list_orders():
    """List orders with optional filters."""
    try:
        status = request.args.get('status')
        customer = request.args.get('customer')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 25, type=int)

        query = Order.query

        if status:
            query = query.filter(Order.status == status)
        if customer:
            query = query.filter(Order.customer_name.ilike(f'%{customer}%'))

        query = query.order_by(Order.created_at.desc())
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        return jsonify({
            'orders': [o.to_dict() for o in pagination.items],
            'total': pagination.total,
            'page': pagination.page,
            'pages': pagination.pages,
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@orders_bp.route('/<int:order_id>', methods=['GET'])
@jwt_required()
def get_order(order_id):
    try:
        order = Order.query.get_or_404(order_id)
        return jsonify({'order': order.to_dict()}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@orders_bp.route('/<int:order_id>', methods=['PUT'])
@jwt_required()
def update_order(order_id):
    try:
        order = Order.query.get_or_404(order_id)
        data = request.get_json()

        if 'customer_name' in data:
            order.customer_name = data['customer_name']
        if 'due_date' in data:
            order.due_date = datetime.strptime(data['due_date'], '%Y-%m-%d').date() if data['due_date'] else None
        if 'notes' in data:
            order.notes = data['notes']
        if 'status' in data:
            order.status = data['status']

        # Update items if provided
        if 'items' in data:
            # Remove old items
            OrderItem.query.filter_by(order_id=order.id).delete()
            for item_data in data['items']:
                width_inches = item_data.get('width_inches', 0)
                width_mm = item_data.get('width_mm', round(width_inches * 25.4, 1))
                weight_kg = item_data.get('weight_kg', 0)
                gsm = item_data.get('gsm')

                if not width_inches and width_mm:
                    width_inches = round(width_mm / 25.4, 1)
                if not width_mm and width_inches:
                    width_mm = round(width_inches * 25.4, 1)

                calc = calculate_rolls_and_shafts(width_mm, weight_kg, gsm, SHAFT_WIDTH_MM)
                order.items.append(OrderItem(
                    width_inches=width_inches,
                    width_mm=width_mm,
                    weight_kg=weight_kg,
                    gsm=gsm,
                    color=item_data.get('color', 'White'),
                    quality_code=item_data.get('quality_code'),
                    rolls_needed=calc['rolls_needed'],
                    rolls_per_shaft=calc['rolls_per_shaft'],
                    shafts_needed=calc['shafts_needed'],
                ))

        db.session.commit()
        return jsonify({'order': order.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@orders_bp.route('/<int:order_id>', methods=['DELETE'])
@jwt_required()
def delete_order(order_id):
    try:
        order = Order.query.get_or_404(order_id)
        db.session.delete(order)
        db.session.commit()
        return jsonify({'message': 'Order deleted'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@orders_bp.route('/config', methods=['GET'])
@jwt_required()
def get_configs():
    """Get config values grouped by type."""
    configs = Config.query.all()
    grouped = {}
    for c in configs:
        if c.config_type not in grouped:
            grouped[c.config_type] = []
        grouped[c.config_type].append(c.to_dict())
    return jsonify(grouped), 200
