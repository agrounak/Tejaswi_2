import os
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required
from app import db
from app.models import Product
from app.utils import generate_product_number, generate_sticker_image

production_bp = Blueprint('production', __name__)


@production_bp.route('/entry', methods=['POST'])
@jwt_required()
def create_product():
    """Create a new product entry with auto-generated serial number and sticker."""
    try:
        data = request.get_json()

        shift = data.get('shift', 'A')
        prod_date_str = data.get('production_date')
        if prod_date_str:
            production_date = datetime.strptime(prod_date_str, '%Y-%m-%d').date()
        else:
            production_date = datetime.utcnow().date()

        product_type = data.get('product_type', 'Roll')

        # Auto-generate serial number
        existing_count = Product.query.filter(
            Product.production_date == production_date,
            Product.shift == shift,
            Product.product_type == product_type,
        ).count()
        serial_no = existing_count + 1

        product_number = generate_product_number(shift, production_date, product_type, serial_no)

        # Ensure product number is unique
        while Product.query.filter_by(product_number=product_number).first():
            serial_no += 1
            product_number = generate_product_number(shift, production_date, product_type, serial_no)

        product = Product(
            product_number=product_number,
            trading_name=data.get('trading_name'),
            shift=shift,
            production_date=production_date,
            serial_no=serial_no,
            quality=data.get('quality'),
            gsm=data.get('gsm'),
            colour=data.get('colour'),
            product_type=product_type,
            gross_weight=data.get('gross_weight'),
            net_weight=data.get('net_weight'),
            length=data.get('length'),
            width=data.get('width'),
            laminated=data.get('laminated', False),
            machine=data.get('machine'),
            status='Sticker Printed',
        )

        db.session.add(product)
        db.session.commit()

        # Generate and save sticker
        sticker_dir = current_app.config.get('STICKER_DIR', 'stickers')
        os.makedirs(sticker_dir, exist_ok=True)

        sticker_bytes = generate_sticker_image(product.to_dict())
        sticker_path = os.path.join(sticker_dir, f"{product_number}.png")
        with open(sticker_path, 'wb') as f:
            f.write(sticker_bytes)

        return jsonify({
            'message': 'Product created successfully',
            'product': product.to_dict(),
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@production_bp.route('/products', methods=['GET'])
@jwt_required()
def list_products():
    """List products with optional filters and pagination."""
    try:
        query = Product.query

        status = request.args.get('status')
        if status:
            query = query.filter(Product.status == status)

        quality = request.args.get('quality')
        if quality:
            query = query.filter(Product.quality == quality)

        product_type = request.args.get('product_type')
        if product_type:
            query = query.filter(Product.product_type == product_type)

        date_from = request.args.get('date_from')
        if date_from:
            query = query.filter(Product.production_date >= datetime.strptime(date_from, '%Y-%m-%d').date())

        date_to = request.args.get('date_to')
        if date_to:
            query = query.filter(Product.production_date <= datetime.strptime(date_to, '%Y-%m-%d').date())

        query = query.order_by(Product.created_at.desc())

        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        return jsonify({
            'products': [p.to_dict() for p in pagination.items],
            'total': pagination.total,
            'page': pagination.page,
            'pages': pagination.pages,
            'per_page': per_page,
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@production_bp.route('/products/<int:product_id>', methods=['GET'])
@jwt_required()
def get_product(product_id):
    """Get a single product by ID."""
    try:
        product = Product.query.get_or_404(product_id)
        return jsonify({'product': product.to_dict()}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@production_bp.route('/products/<int:product_id>', methods=['PUT'])
@jwt_required()
def update_product(product_id):
    """Update product fields."""
    try:
        product = Product.query.get_or_404(product_id)
        data = request.get_json()

        updatable_fields = [
            'trading_name', 'quality', 'gsm', 'colour', 'product_type',
            'gross_weight', 'net_weight', 'length', 'width', 'laminated',
            'machine', 'location', 'status',
        ]

        for field in updatable_fields:
            if field in data:
                setattr(product, field, data[field])

        db.session.commit()
        return jsonify({'message': 'Product updated', 'product': product.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@production_bp.route('/products/<int:product_id>', methods=['DELETE'])
@jwt_required()
def delete_product(product_id):
    """Delete a product."""
    try:
        product = Product.query.get_or_404(product_id)
        db.session.delete(product)
        db.session.commit()
        return jsonify({'message': 'Product deleted'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@production_bp.route('/scan/<product_number>', methods=['GET'])
@jwt_required()
def scan_product(product_number):
    """Find product by product number (barcode/QR scan)."""
    try:
        product = Product.query.filter_by(product_number=product_number).first()
        if not product:
            return jsonify({'error': 'Product not found'}), 404
        return jsonify({'product': product.to_dict()}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
