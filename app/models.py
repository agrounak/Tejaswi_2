from datetime import datetime, timezone
from werkzeug.security import generate_password_hash, check_password_hash
from app import db


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='Sticker User')
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


class Product(db.Model):
    __tablename__ = 'products'

    id = db.Column(db.Integer, primary_key=True)
    product_number = db.Column(db.String(50), unique=True, nullable=False)
    trading_name = db.Column(db.String(200))
    shift = db.Column(db.String(10), nullable=False)
    production_date = db.Column(db.Date, nullable=False)
    serial_no = db.Column(db.Integer, nullable=False)
    quality = db.Column(db.String(50))
    gsm = db.Column(db.Float)
    colour = db.Column(db.String(50))
    product_type = db.Column(db.String(50))
    gross_weight = db.Column(db.Float)
    net_weight = db.Column(db.Float)
    length = db.Column(db.Float)
    width = db.Column(db.Float)
    laminated = db.Column(db.Boolean, default=False)
    machine = db.Column(db.String(50))
    location = db.Column(db.String(100))
    status = db.Column(db.String(30), default='Manufactured')
    dispatch_id = db.Column(db.Integer, db.ForeignKey('dispatches.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id,
            'product_number': self.product_number,
            'trading_name': self.trading_name,
            'shift': self.shift,
            'production_date': self.production_date.isoformat() if self.production_date else None,
            'serial_no': self.serial_no,
            'quality': self.quality,
            'gsm': self.gsm,
            'colour': self.colour,
            'product_type': self.product_type,
            'gross_weight': self.gross_weight,
            'net_weight': self.net_weight,
            'length': self.length,
            'width': self.width,
            'laminated': self.laminated,
            'machine': self.machine,
            'location': self.location,
            'status': self.status,
            'dispatch_id': self.dispatch_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Dispatch(db.Model):
    __tablename__ = 'dispatches'

    id = db.Column(db.Integer, primary_key=True)
    dispatch_number = db.Column(db.String(50), unique=True, nullable=False)
    client_name = db.Column(db.String(200), nullable=False)
    vehicle_number = db.Column(db.String(50))
    driver_name = db.Column(db.String(100))
    driver_phone = db.Column(db.String(20))
    dispatch_date = db.Column(db.Date)
    status = db.Column(db.String(30), default='In Progress')
    total_items = db.Column(db.Integer, default=0)
    total_weight = db.Column(db.Float, default=0.0)
    created_by = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    items = db.relationship('DispatchItem', backref='dispatch', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'dispatch_number': self.dispatch_number,
            'client_name': self.client_name,
            'vehicle_number': self.vehicle_number,
            'driver_name': self.driver_name,
            'driver_phone': self.driver_phone,
            'dispatch_date': self.dispatch_date.isoformat() if self.dispatch_date else None,
            'status': self.status,
            'total_items': self.total_items,
            'total_weight': self.total_weight,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'items': [item.to_dict() for item in self.items],
        }


class DispatchItem(db.Model):
    __tablename__ = 'dispatch_items'

    id = db.Column(db.Integer, primary_key=True)
    dispatch_id = db.Column(db.Integer, db.ForeignKey('dispatches.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    weight = db.Column(db.Float)
    scanned_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    product = db.relationship('Product', backref='dispatch_items')

    def to_dict(self):
        return {
            'id': self.id,
            'dispatch_id': self.dispatch_id,
            'product_id': self.product_id,
            'weight': self.weight,
            'scanned_at': self.scanned_at.isoformat() if self.scanned_at else None,
            'product': self.product.to_dict() if self.product else None,
        }


class Order(db.Model):
    __tablename__ = 'orders'

    id = db.Column(db.Integer, primary_key=True)
    order_number = db.Column(db.String(50), unique=True, nullable=False)
    client_name = db.Column(db.String(200), nullable=False)
    client_phone = db.Column(db.String(20))
    client_address = db.Column(db.Text)
    order_date = db.Column(db.Date)
    required_date = db.Column(db.Date)
    status = db.Column(db.String(30), default='Pending')
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    items = db.relationship('OrderItem', backref='order', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'order_number': self.order_number,
            'client_name': self.client_name,
            'client_phone': self.client_phone,
            'client_address': self.client_address,
            'order_date': self.order_date.isoformat() if self.order_date else None,
            'required_date': self.required_date.isoformat() if self.required_date else None,
            'status': self.status,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'items': [item.to_dict() for item in self.items],
        }


class OrderItem(db.Model):
    __tablename__ = 'order_items'

    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)
    product_type = db.Column(db.String(50))
    gsm = db.Column(db.Float)
    colour = db.Column(db.String(50))
    width = db.Column(db.Float)
    quantity_kg = db.Column(db.Float)
    allocated_kg = db.Column(db.Float, default=0)

    def to_dict(self):
        return {
            'id': self.id,
            'order_id': self.order_id,
            'product_type': self.product_type,
            'gsm': self.gsm,
            'colour': self.colour,
            'width': self.width,
            'quantity_kg': self.quantity_kg,
            'allocated_kg': self.allocated_kg,
        }


class Config(db.Model):
    __tablename__ = 'configs'

    id = db.Column(db.Integer, primary_key=True)
    config_type = db.Column(db.String(50), nullable=False)
    value = db.Column(db.String(200), nullable=False)
    is_white = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id,
            'config_type': self.config_type,
            'value': self.value,
            'is_white': self.is_white,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
