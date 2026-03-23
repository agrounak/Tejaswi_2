import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_cors import CORS

db = SQLAlchemy()
jwt = JWTManager()


def create_app(config_name='default'):
    app = Flask(__name__)

    from config import config_by_name
    app.config.from_object(config_by_name.get(config_name, config_by_name['default']))

    db.init_app(app)
    jwt.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    os.makedirs(app.config.get('STICKER_DIR', 'stickers'), exist_ok=True)

    from app.routes.auth import auth_bp
    from app.routes.production import production_bp
    from app.routes.sticker import sticker_bp
    from app.routes.inventory import inventory_bp
    from app.routes.dispatch import dispatch_bp
    from app.routes.orders import orders_bp
    from app.routes.dashboard import dashboard_bp
    from app.routes.config_routes import config_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(production_bp, url_prefix='/api/production')
    app.register_blueprint(sticker_bp, url_prefix='/api/sticker')
    app.register_blueprint(inventory_bp, url_prefix='/api/inventory')
    app.register_blueprint(dispatch_bp, url_prefix='/api/dispatch')
    app.register_blueprint(orders_bp, url_prefix='/api/orders')
    app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')
    app.register_blueprint(config_bp, url_prefix='/api/config')

    with app.app_context():
        from app import models  # noqa: F401
        db.create_all()

        # Create default admin user if none exists
        from app.models import User
        if not User.query.filter_by(role='Admin').first():
            admin = User(username='admin', role='Admin')
            admin.set_password('admin123')
            db.session.add(admin)
            db.session.commit()

    return app
