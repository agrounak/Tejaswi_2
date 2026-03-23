from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app import db
from app.models import Config

config_bp = Blueprint('config_bp', __name__)


@config_bp.route('/', methods=['GET'])
@jwt_required()
def list_configs():
    """List configs, optional filter by type."""
    try:
        config_type = request.args.get('type')
        query = Config.query

        if config_type:
            query = query.filter_by(config_type=config_type)

        configs = query.order_by(Config.config_type, Config.value).all()
        return jsonify({'configs': [c.to_dict() for c in configs]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@config_bp.route('/', methods=['POST'])
@jwt_required()
def add_config():
    """Add a new config entry."""
    try:
        data = request.get_json()
        config_type = data.get('config_type')
        value = data.get('value')

        if not config_type or not value:
            return jsonify({'error': 'config_type and value are required'}), 400

        # Check for duplicate
        existing = Config.query.filter_by(
            config_type=config_type, value=value
        ).first()
        if existing:
            return jsonify({'error': 'Config entry already exists'}), 409

        config = Config(
            config_type=config_type,
            value=value,
            is_white=data.get('is_white', False),
        )

        db.session.add(config)
        db.session.commit()

        return jsonify({
            'message': 'Config added',
            'config': config.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@config_bp.route('/<int:config_id>', methods=['DELETE'])
@jwt_required()
def delete_config(config_id):
    """Delete a config entry."""
    try:
        config = Config.query.get_or_404(config_id)
        db.session.delete(config)
        db.session.commit()
        return jsonify({'message': 'Config deleted'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@config_bp.route('/seed', methods=['POST'])
@jwt_required()
def seed_defaults():
    """Seed default configuration values."""
    try:
        defaults = {
            'quality': [
                {'value': 'Premium', 'is_white': False},
                {'value': 'Standard', 'is_white': False},
                {'value': 'Economy', 'is_white': False},
                {'value': 'Export', 'is_white': False},
            ],
            'colour': [
                {'value': 'White', 'is_white': True},
                {'value': 'Black', 'is_white': False},
                {'value': 'Blue', 'is_white': False},
                {'value': 'Green', 'is_white': False},
                {'value': 'Red', 'is_white': False},
                {'value': 'Yellow', 'is_white': False},
                {'value': 'Grey', 'is_white': False},
                {'value': 'Brown', 'is_white': False},
            ],
            'product_type': [
                {'value': 'Roll', 'is_white': False},
                {'value': 'Cut Piece', 'is_white': False},
                {'value': 'Bag', 'is_white': False},
                {'value': 'Sheet', 'is_white': False},
                {'value': 'Fabric', 'is_white': False},
            ],
            'location': [
                {'value': 'Warehouse A', 'is_white': False},
                {'value': 'Warehouse B', 'is_white': False},
                {'value': 'Warehouse C', 'is_white': False},
                {'value': 'Production Floor', 'is_white': False},
                {'value': 'Dispatch Bay', 'is_white': False},
            ],
            'machine': [
                {'value': 'Machine 1', 'is_white': False},
                {'value': 'Machine 2', 'is_white': False},
                {'value': 'Machine 3', 'is_white': False},
                {'value': 'Machine 4', 'is_white': False},
            ],
        }

        added = 0
        for config_type, entries in defaults.items():
            for entry in entries:
                existing = Config.query.filter_by(
                    config_type=config_type, value=entry['value']
                ).first()
                if not existing:
                    config = Config(
                        config_type=config_type,
                        value=entry['value'],
                        is_white=entry.get('is_white', False),
                    )
                    db.session.add(config)
                    added += 1

        db.session.commit()

        return jsonify({
            'message': f'Seed complete. {added} new entries added.',
            'added': added,
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
