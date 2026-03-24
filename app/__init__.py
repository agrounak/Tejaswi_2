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

    from app.routes.auth import auth_bp
    from app.routes.orders import orders_bp
    from app.routes.planning import planning_bp
    from app.routes.schedule import schedule_bp
    from app.routes.dashboard import dashboard_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(orders_bp, url_prefix='/api/orders')
    app.register_blueprint(planning_bp, url_prefix='/api/planning')
    app.register_blueprint(schedule_bp, url_prefix='/api/schedule')
    app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')

    with app.app_context():
        from app import models  # noqa: F401
        db.create_all()

        # Create default admin user
        from app.models import User
        if not User.query.filter_by(role='Admin').first():
            admin = User(username='admin', role='Admin')
            admin.set_password('admin123')
            db.session.add(admin)
            db.session.commit()

        # Seed default colors and quality codes
        from app.models import Config
        if not Config.query.first():
            defaults = [
                ('color', 'White'), ('color', 'Ivory'), ('color', 'Lemon Yellow'),
                ('color', 'Golden Yellow'), ('color', 'Red'), ('color', 'Blue'),
                ('color', 'Green'), ('color', 'Black'), ('color', 'Pink'),
                ('color', 'Orange'), ('color', 'Grey'),
                ('quality', 'Dcut'), ('quality', 'W-Cut'), ('quality', 'U-Cut'),
                ('quality', 'Box Bag'), ('quality', 'Loop Handle'),
                ('gsm', '10'), ('gsm', '12'), ('gsm', '14'), ('gsm', '16'),
                ('gsm', '18'), ('gsm', '20'), ('gsm', '25'), ('gsm', '30'),
                ('gsm', '35'), ('gsm', '40'), ('gsm', '50'), ('gsm', '60'),
                ('gsm', '70'), ('gsm', '80'), ('gsm', '90'), ('gsm', '100'),
            ]
            for config_type, value in defaults:
                db.session.add(Config(config_type=config_type, value=value))
            db.session.commit()

    return app
