import io
import csv
from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required
from app import db
from app.models import Product, Config

inventory_bp = Blueprint('inventory', __name__)


@inventory_bp.route('/stock', methods=['GET'])
@jwt_required()
def get_stock():
    """List products currently in stock (In Warehouse or Sticker Printed)."""
    try:
        query = Product.query.filter(
            Product.status.in_(['In Warehouse', 'Sticker Printed'])
        )

        quality = request.args.get('quality')
        if quality:
            query = query.filter(Product.quality == quality)

        colour = request.args.get('colour')
        if colour:
            query = query.filter(Product.colour == colour)

        location = request.args.get('location')
        if location:
            query = query.filter(Product.location == location)

        product_type = request.args.get('product_type')
        if product_type:
            query = query.filter(Product.product_type == product_type)

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


@inventory_bp.route('/summary', methods=['GET'])
@jwt_required()
def get_summary():
    """Return aggregated inventory summary."""
    try:
        stock_query = Product.query.filter(
            Product.status.in_(['In Warehouse', 'Sticker Printed'])
        )

        total_items = stock_query.count()
        total_weight = db.session.query(
            db.func.coalesce(db.func.sum(Product.net_weight), 0)
        ).filter(
            Product.status.in_(['In Warehouse', 'Sticker Printed'])
        ).scalar()

        # Group by product_type
        by_type_rows = db.session.query(
            Product.product_type,
            db.func.count(Product.id),
            db.func.coalesce(db.func.sum(Product.net_weight), 0)
        ).filter(
            Product.status.in_(['In Warehouse', 'Sticker Printed'])
        ).group_by(Product.product_type).all()

        by_type = [
            {'product_type': row[0], 'count': row[1], 'total_weight': round(row[2], 2)}
            for row in by_type_rows
        ]

        # Group by location
        by_location_rows = db.session.query(
            Product.location,
            db.func.count(Product.id),
            db.func.coalesce(db.func.sum(Product.net_weight), 0)
        ).filter(
            Product.status.in_(['In Warehouse', 'Sticker Printed'])
        ).group_by(Product.location).all()

        by_location = [
            {'location': row[0] or 'Unassigned', 'count': row[1], 'total_weight': round(row[2], 2)}
            for row in by_location_rows
        ]

        # Group by quality
        by_quality_rows = db.session.query(
            Product.quality,
            db.func.count(Product.id),
            db.func.coalesce(db.func.sum(Product.net_weight), 0)
        ).filter(
            Product.status.in_(['In Warehouse', 'Sticker Printed'])
        ).group_by(Product.quality).all()

        by_quality = [
            {'quality': row[0], 'count': row[1], 'total_weight': round(row[2], 2)}
            for row in by_quality_rows
        ]

        return jsonify({
            'total_items': total_items,
            'total_weight': round(total_weight, 2),
            'by_type': by_type,
            'by_location': by_location,
            'by_quality': by_quality,
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@inventory_bp.route('/locations', methods=['GET'])
@jwt_required()
def get_locations():
    """Return distinct locations from Config."""
    try:
        configs = Config.query.filter_by(config_type='location').all()
        locations = [c.value for c in configs]
        return jsonify({'locations': locations}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@inventory_bp.route('/export', methods=['GET'])
@jwt_required()
def export_stock():
    """Export current stock as CSV."""
    try:
        products = Product.query.filter(
            Product.status.in_(['In Warehouse', 'Sticker Printed'])
        ).order_by(Product.created_at.desc()).all()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            'Product Number', 'Trading Name', 'Shift', 'Production Date',
            'Quality', 'GSM', 'Colour', 'Type', 'Gross Weight', 'Net Weight',
            'Length', 'Width', 'Laminated', 'Machine', 'Location', 'Status'
        ])

        for p in products:
            writer.writerow([
                p.product_number, p.trading_name, p.shift,
                p.production_date.isoformat() if p.production_date else '',
                p.quality, p.gsm, p.colour, p.product_type,
                p.gross_weight, p.net_weight, p.length, p.width,
                'Yes' if p.laminated else 'No', p.machine, p.location, p.status
            ])

        output.seek(0)
        bytes_output = io.BytesIO(output.getvalue().encode('utf-8'))

        return send_file(
            bytes_output,
            mimetype='text/csv',
            as_attachment=True,
            download_name='stock_export.csv'
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@inventory_bp.route('/receive', methods=['POST'])
@jwt_required()
def receive_product():
    """Mark a product as In Warehouse by product_number."""
    try:
        data = request.get_json()
        product_number = data.get('product_number')

        if not product_number:
            return jsonify({'error': 'product_number is required'}), 400

        product = Product.query.filter_by(product_number=product_number).first()
        if not product:
            return jsonify({'error': 'Product not found'}), 404

        product.status = 'In Warehouse'
        if data.get('location'):
            product.location = data['location']

        db.session.commit()

        return jsonify({
            'message': 'Product received into warehouse',
            'product': product.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
