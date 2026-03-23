import io
from flask import Blueprint, send_file, jsonify
from flask_jwt_extended import jwt_required
from app.models import Product
from app.utils import generate_sticker_image

sticker_bp = Blueprint('sticker', __name__)


@sticker_bp.route('/<int:product_id>', methods=['GET'])
@jwt_required()
def download_sticker(product_id):
    """Download sticker PNG for a product."""
    try:
        product = Product.query.get_or_404(product_id)
        sticker_bytes = generate_sticker_image(product.to_dict())

        return send_file(
            io.BytesIO(sticker_bytes),
            mimetype='image/png',
            as_attachment=True,
            download_name=f"sticker_{product.product_number}.png"
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@sticker_bp.route('/<int:product_id>/preview', methods=['GET'])
@jwt_required()
def preview_sticker(product_id):
    """Preview sticker as inline image."""
    try:
        product = Product.query.get_or_404(product_id)
        sticker_bytes = generate_sticker_image(product.to_dict())

        return send_file(
            io.BytesIO(sticker_bytes),
            mimetype='image/png',
            as_attachment=False,
            download_name=f"sticker_{product.product_number}.png"
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500
