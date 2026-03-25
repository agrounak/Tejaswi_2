from datetime import datetime, timezone
from werkzeug.security import generate_password_hash, check_password_hash
from app import db


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='Operator')
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'role': self.role,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Order(db.Model):
    __tablename__ = 'orders'

    id = db.Column(db.Integer, primary_key=True)
    customer_name = db.Column(db.String(200), nullable=False)
    order_date = db.Column(db.Date, default=lambda: datetime.now(timezone.utc).date())
    due_date = db.Column(db.Date, nullable=True)
    status = db.Column(db.String(30), default='Pending')  # Pending, Planned, In Progress, Completed
    notes = db.Column(db.Text, nullable=True)
    raw_text = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    items = db.relationship('OrderItem', backref='order', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'customer_name': self.customer_name,
            'order_date': self.order_date.isoformat() if self.order_date else None,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'status': self.status,
            'notes': self.notes,
            'raw_text': self.raw_text,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'items': [item.to_dict() for item in self.items],
            'total_weight': sum(item.weight_kg or 0 for item in self.items),
            'item_count': len(self.items),
        }


class OrderItem(db.Model):
    __tablename__ = 'order_items'

    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)
    width_inches = db.Column(db.Float, nullable=False)
    width_mm = db.Column(db.Float, nullable=False)
    weight_kg = db.Column(db.Float, nullable=False)
    gsm = db.Column(db.Float, nullable=True)
    color = db.Column(db.String(50), default='White')
    quality_code = db.Column(db.String(50), nullable=True)
    rolls_needed = db.Column(db.Integer, default=0)
    rolls_per_shaft = db.Column(db.Integer, default=0)
    shafts_needed = db.Column(db.Integer, default=0)
    status = db.Column(db.String(30), default='Pending')  # Pending, Planned, Produced, Delivered

    run_items = db.relationship('RunItem', backref='order_item', lazy=True)

    def to_dict(self):
        produced = sum(ri.rolls_count for ri in self.run_items)
        return {
            'id': self.id,
            'order_id': self.order_id,
            'width_inches': self.width_inches,
            'width_mm': self.width_mm,
            'weight_kg': self.weight_kg,
            'gsm': self.gsm,
            'color': self.color,
            'quality_code': self.quality_code,
            'rolls_needed': self.rolls_needed,
            'rolls_per_shaft': self.rolls_per_shaft,
            'shafts_needed': self.shafts_needed,
            'status': self.status,
            'rolls_produced': produced,
        }


class ProductionRun(db.Model):
    __tablename__ = 'production_runs'

    id = db.Column(db.Integer, primary_key=True)
    run_date = db.Column(db.Date, nullable=False)
    shaft_number = db.Column(db.Integer, default=1)
    status = db.Column(db.String(30), default='Planned')  # Planned, In Progress, Completed
    total_width_used_mm = db.Column(db.Float, default=0)
    trim_loss_mm = db.Column(db.Float, default=0)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    run_items = db.relationship('RunItem', backref='production_run', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        shaft_width = 3124.2  # 123 inches
        return {
            'id': self.id,
            'run_date': self.run_date.isoformat() if self.run_date else None,
            'shaft_number': self.shaft_number,
            'status': self.status,
            'total_width_used_mm': self.total_width_used_mm,
            'trim_loss_mm': self.trim_loss_mm,
            'utilization_pct': round((self.total_width_used_mm / shaft_width) * 100, 1) if self.total_width_used_mm else 0,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'items': [item.to_dict() for item in self.run_items],
        }


class RunItem(db.Model):
    __tablename__ = 'run_items'

    id = db.Column(db.Integer, primary_key=True)
    production_run_id = db.Column(db.Integer, db.ForeignKey('production_runs.id'), nullable=False)
    order_item_id = db.Column(db.Integer, db.ForeignKey('order_items.id'), nullable=False)
    rolls_count = db.Column(db.Integer, default=1)
    width_mm = db.Column(db.Float, nullable=False)
    color = db.Column(db.String(50), default='White')
    customer_name = db.Column(db.String(200), nullable=True)

    def to_dict(self):
        oi = self.order_item
        return {
            'id': self.id,
            'production_run_id': self.production_run_id,
            'order_item_id': self.order_item_id,
            'rolls_count': self.rolls_count,
            'width_mm': self.width_mm,
            'width_inches': round(self.width_mm / 25.4, 1),
            'color': self.color,
            'customer_name': self.customer_name or (oi.order.customer_name if oi and oi.order else ''),
            'gsm': oi.gsm if oi else None,
            'quality_code': oi.quality_code if oi else None,
        }


class Config(db.Model):
    __tablename__ = 'configs'

    id = db.Column(db.Integer, primary_key=True)
    config_type = db.Column(db.String(50), nullable=False)
    value = db.Column(db.String(200), nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'config_type': self.config_type,
            'value': self.value,
        }
