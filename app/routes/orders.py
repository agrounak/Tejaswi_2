from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app import db
from app.models import Order, OrderItem, Product

orders_bp = Blueprint('orders', __name__)


def _generate_order_number():
    """Generate order number like ORD-YYMMDD-NNN."""
    today = datetime.now(timezone.utc).date()
    date_str = today.strftime('%y%m%d')
    prefix = f"ORD-{date_str}-"

    last = Order.query.filter(
        Order.order_number.like(f"{prefix}%")
    ).order_by(Order.order_number.desc()).first()

    if last:
        try:
            last_num = int(last.order_number.split('-')[-1])
            next_num = last_num + 1
        except (ValueError, IndexError):
            next_num = 1
    else:
        next_num = 1

    return f"{prefix}{str(next_num).zfill(3)}"


@orders_bp.route('/', methods=['POST'])
@jwt_required()
def create_order():
    """Create a new order with items."""
    try:
        data = request.get_json()
        client_name = data.get('client_name')

        if not client_name:
            return jsonify({'error': 'client_name is required'}), 400

        order_date_str = data.get('order_date')
        order_date = (
            datetime.strptime(order_date_str, '%Y-%m-%d').date()
            if order_date_str
            else datetime.now(timezone.utc).date()
        )

        required_date_str = data.get('required_date')
        required_date = (
            datetime.strptime(required_date_str, '%Y-%m-%d').date()
            if required_date_str
            else None
        )

        order = Order(
            order_number=_generate_order_number(),
            client_name=client_name,
            client_phone=data.get('client_phone'),
            client_address=data.get('client_address'),
            order_date=order_date,
            required_date=required_date,
            status='Pending',
            notes=data.get('notes'),
        )

        db.session.add(order)
        db.session.flush()  # get order.id

        items_data = data.get('items', [])
        for item_data in items_data:
            item = OrderItem(
                order_id=order.id,
                product_type=item_data.get('product_type'),
                gsm=item_data.get('gsm'),
                colour=item_data.get('colour'),
                width=item_data.get('width'),
                quantity_kg=item_data.get('quantity_kg', 0),
                allocated_kg=0,
            )
            db.session.add(item)

        db.session.commit()

        return jsonify({
            'message': 'Order created',
            'order': order.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@orders_bp.route('/', methods=['GET'])
@jwt_required()
def list_orders():
    """List all orders."""
    try:
        orders = Order.query.order_by(Order.created_at.desc()).all()
        return jsonify({'orders': [o.to_dict() for o in orders]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@orders_bp.route('/<int:order_id>', methods=['GET'])
@jwt_required()
def get_order(order_id):
    """Get order details with items."""
    try:
        order = Order.query.get_or_404(order_id)
        return jsonify({'order': order.to_dict()}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@orders_bp.route('/<int:order_id>', methods=['PUT'])
@jwt_required()
def update_order(order_id):
    """Update an order."""
    try:
        order = Order.query.get_or_404(order_id)
        data = request.get_json()

        if 'client_name' in data:
            order.client_name = data['client_name']
        if 'client_phone' in data:
            order.client_phone = data['client_phone']
        if 'client_address' in data:
            order.client_address = data['client_address']
        if 'status' in data:
            order.status = data['status']
        if 'notes' in data:
            order.notes = data['notes']
        if 'required_date' in data and data['required_date']:
            order.required_date = datetime.strptime(data['required_date'], '%Y-%m-%d').date()

        # Update items if provided
        if 'items' in data:
            # Remove existing items and re-create
            OrderItem.query.filter_by(order_id=order.id).delete()
            for item_data in data['items']:
                item = OrderItem(
                    order_id=order.id,
                    product_type=item_data.get('product_type'),
                    gsm=item_data.get('gsm'),
                    colour=item_data.get('colour'),
                    width=item_data.get('width'),
                    quantity_kg=item_data.get('quantity_kg', 0),
                    allocated_kg=item_data.get('allocated_kg', 0),
                )
                db.session.add(item)

        db.session.commit()
        return jsonify({
            'message': 'Order updated',
            'order': order.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@orders_bp.route('/<int:order_id>/allocate', methods=['POST'])
@jwt_required()
def allocate_inventory(order_id):
    """Allocate inventory to order items by finding matching products."""
    try:
        order = Order.query.get_or_404(order_id)
        allocated_products = []

        for item in order.items:
            remaining = item.quantity_kg - item.allocated_kg
            if remaining <= 0:
                continue

            # Find matching products in stock
            query = Product.query.filter(
                Product.status.in_(['In Warehouse', 'Sticker Printed'])
            )

            if item.product_type:
                query = query.filter(Product.product_type == item.product_type)
            if item.gsm:
                query = query.filter(Product.gsm == item.gsm)
            if item.colour:
                query = query.filter(Product.colour == item.colour)
            if item.width:
                query = query.filter(Product.width == item.width)

            matching_products = query.order_by(Product.created_at.asc()).all()

            for product in matching_products:
                if remaining <= 0:
                    break

                product_weight = product.net_weight or 0
                if product_weight <= 0:
                    continue

                item.allocated_kg += product_weight
                remaining -= product_weight
                allocated_products.append(product.product_number)

        db.session.commit()

        if order.items and all(
            item.allocated_kg >= item.quantity_kg for item in order.items
        ):
            order.status = 'Fulfilled'
            db.session.commit()
        elif any(item.allocated_kg > 0 for item in order.items):
            order.status = 'Partially Fulfilled'
            db.session.commit()

        return jsonify({
            'message': 'Allocation complete',
            'order': order.to_dict(),
            'allocated_products': allocated_products,
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
