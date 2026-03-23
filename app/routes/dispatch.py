import io
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt
from app import db
from app.models import Dispatch, DispatchItem, Product
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT

dispatch_bp = Blueprint('dispatch', __name__)


def _generate_dispatch_number():
    """Generate dispatch number like DN-YYMMDD-NNN."""
    today = datetime.now(timezone.utc).date()
    date_str = today.strftime('%y%m%d')
    prefix = f"DN-{date_str}-"

    last = Dispatch.query.filter(
        Dispatch.dispatch_number.like(f"{prefix}%")
    ).order_by(Dispatch.dispatch_number.desc()).first()

    if last:
        try:
            last_num = int(last.dispatch_number.split('-')[-1])
            next_num = last_num + 1
        except (ValueError, IndexError):
            next_num = 1
    else:
        next_num = 1

    return f"{prefix}{str(next_num).zfill(3)}"


def _build_slip_pdf(dispatch, title="Packing Slip"):
    """Build a packing slip PDF and return bytes."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=20*mm, bottomMargin=20*mm)
    styles = getSampleStyleSheet()
    elements = []

    # Title style
    title_style = ParagraphStyle(
        'SlipTitle', parent=styles['Heading1'],
        fontSize=18, alignment=TA_CENTER, spaceAfter=10
    )
    subtitle_style = ParagraphStyle(
        'SubTitle', parent=styles['Normal'],
        fontSize=12, alignment=TA_CENTER, spaceAfter=6
    )
    normal_style = ParagraphStyle(
        'NormalLeft', parent=styles['Normal'],
        fontSize=10, alignment=TA_LEFT, spaceAfter=4
    )

    # Header
    elements.append(Paragraph("TEJASWI NONWOVENS", title_style))
    elements.append(Paragraph(title, subtitle_style))
    elements.append(Spacer(1, 10))

    # Dispatch details
    elements.append(Paragraph(f"<b>Dispatch No:</b> {dispatch.dispatch_number}", normal_style))
    elements.append(Paragraph(f"<b>Client:</b> {dispatch.client_name}", normal_style))
    elements.append(Paragraph(f"<b>Date:</b> {dispatch.dispatch_date or ''}", normal_style))
    elements.append(Paragraph(f"<b>Vehicle:</b> {dispatch.vehicle_number or 'N/A'}", normal_style))
    elements.append(Paragraph(f"<b>Driver:</b> {dispatch.driver_name or 'N/A'} ({dispatch.driver_phone or 'N/A'})", normal_style))
    elements.append(Spacer(1, 10))

    # Items table
    table_data = [['#', 'Product No', 'Type', 'Quality', 'GSM', 'Colour', 'Net Wt (kg)']]

    total_weight = 0.0
    for idx, item in enumerate(dispatch.items, 1):
        product = Product.query.get(item.product_id)
        if product:
            weight = product.net_weight or 0
            total_weight += weight
            table_data.append([
                str(idx),
                product.product_number,
                product.product_type or '',
                product.quality or '',
                str(product.gsm or ''),
                product.colour or '',
                f"{weight:.2f}",
            ])

    table_data.append(['', '', '', '', '', 'Total:', f"{total_weight:.2f}"])

    table = Table(table_data, repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a237e')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.HexColor('#f5f5f5')]),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('LINEABOVE', (0, -1), (-1, -1), 1, colors.black),
    ]))
    elements.append(table)
    elements.append(Spacer(1, 20))

    elements.append(Paragraph(f"<b>Total Items:</b> {len(dispatch.items)}", normal_style))
    elements.append(Paragraph(f"<b>Total Weight:</b> {total_weight:.2f} kg", normal_style))
    elements.append(Spacer(1, 30))

    # Signatures
    sig_table = Table([
        ['Prepared By', 'Checked By', 'Received By'],
        ['____________', '____________', '____________'],
    ], colWidths=[150, 150, 150])
    sig_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING', (0, 1), (-1, 1), 30),
    ]))
    elements.append(sig_table)

    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()


@dispatch_bp.route('/start', methods=['POST'])
@jwt_required()
def start_dispatch():
    """Create a new dispatch."""
    try:
        data = request.get_json()
        client_name = data.get('client_name')

        if not client_name:
            return jsonify({'error': 'client_name is required'}), 400

        dispatch_date_str = data.get('dispatch_date')
        if dispatch_date_str:
            dispatch_date = datetime.strptime(dispatch_date_str, '%Y-%m-%d').date()
        else:
            dispatch_date = datetime.now(timezone.utc).date()

        claims = get_jwt()

        dispatch = Dispatch(
            dispatch_number=_generate_dispatch_number(),
            client_name=client_name,
            dispatch_date=dispatch_date,
            vehicle_number=data.get('vehicle_number'),
            driver_name=data.get('driver_name'),
            driver_phone=data.get('driver_phone'),
            created_by=claims.get('username', ''),
            status='In Progress',
        )

        db.session.add(dispatch)
        db.session.commit()

        return jsonify({
            'message': 'Dispatch created',
            'dispatch': dispatch.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@dispatch_bp.route('/', methods=['GET'])
@jwt_required()
def list_dispatches():
    """List active dispatches."""
    try:
        dispatches = Dispatch.query.filter(
            Dispatch.status != 'Dispatched'
        ).order_by(Dispatch.created_at.desc()).all()

        return jsonify({
            'dispatches': [d.to_dict() for d in dispatches]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@dispatch_bp.route('/history', methods=['GET'])
@jwt_required()
def dispatch_history():
    """List completed dispatches."""
    try:
        dispatches = Dispatch.query.filter_by(
            status='Dispatched'
        ).order_by(Dispatch.created_at.desc()).all()

        return jsonify({
            'dispatches': [d.to_dict() for d in dispatches]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@dispatch_bp.route('/<int:dispatch_id>', methods=['GET'])
@jwt_required()
def get_dispatch(dispatch_id):
    """Get dispatch details with items."""
    try:
        dispatch = Dispatch.query.get_or_404(dispatch_id)
        return jsonify({'dispatch': dispatch.to_dict()}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@dispatch_bp.route('/<int:dispatch_id>/details', methods=['PUT'])
@jwt_required()
def update_dispatch_details(dispatch_id):
    """Update vehicle and driver details."""
    try:
        dispatch = Dispatch.query.get_or_404(dispatch_id)
        data = request.get_json()

        if 'vehicle_number' in data:
            dispatch.vehicle_number = data['vehicle_number']
        if 'driver_name' in data:
            dispatch.driver_name = data['driver_name']
        if 'driver_phone' in data:
            dispatch.driver_phone = data['driver_phone']

        db.session.commit()
        return jsonify({
            'message': 'Dispatch details updated',
            'dispatch': dispatch.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@dispatch_bp.route('/<int:dispatch_id>/scan', methods=['POST'])
@jwt_required()
def scan_into_dispatch(dispatch_id):
    """Scan a product into a dispatch."""
    try:
        dispatch = Dispatch.query.get_or_404(dispatch_id)

        if dispatch.status == 'Dispatched':
            return jsonify({'error': 'Dispatch already finalized'}), 400

        data = request.get_json()
        product_number = data.get('product_number')

        if not product_number:
            return jsonify({'error': 'product_number is required'}), 400

        product = Product.query.filter_by(product_number=product_number).first()
        if not product:
            return jsonify({'error': 'Product not found'}), 404

        if product.status == 'Dispatched':
            return jsonify({'error': 'Product already dispatched'}), 400

        if product.status == 'Allocated':
            return jsonify({'error': 'Product already allocated to another dispatch'}), 400

        # Check if already in this dispatch
        existing = DispatchItem.query.filter_by(
            dispatch_id=dispatch_id, product_id=product.id
        ).first()
        if existing:
            return jsonify({'error': 'Product already in this dispatch'}), 400

        item = DispatchItem(
            dispatch_id=dispatch_id,
            product_id=product.id,
            weight=product.net_weight or 0,
        )

        product.status = 'Allocated'
        product.dispatch_id = dispatch.id

        db.session.add(item)
        db.session.commit()

        return jsonify({
            'message': 'Product scanned into dispatch',
            'item': item.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@dispatch_bp.route('/<int:dispatch_id>/remove/<int:item_id>', methods=['DELETE'])
@jwt_required()
def remove_from_dispatch(dispatch_id, item_id):
    """Remove an item from dispatch and reset product status."""
    try:
        item = DispatchItem.query.filter_by(
            id=item_id, dispatch_id=dispatch_id
        ).first()

        if not item:
            return jsonify({'error': 'Item not found in this dispatch'}), 404

        product = Product.query.get(item.product_id)
        if product:
            product.status = 'In Warehouse'
            product.dispatch_id = None

        db.session.delete(item)
        db.session.commit()

        return jsonify({'message': 'Item removed from dispatch'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@dispatch_bp.route('/<int:dispatch_id>/rough-slip', methods=['POST'])
@jwt_required()
def rough_slip(dispatch_id):
    """Generate a rough packing slip PDF."""
    try:
        dispatch = Dispatch.query.get_or_404(dispatch_id)
        pdf_bytes = _build_slip_pdf(dispatch, title="ROUGH Packing Slip")

        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f"rough_slip_{dispatch.dispatch_number}.pdf"
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@dispatch_bp.route('/<int:dispatch_id>/final-slip', methods=['POST'])
@jwt_required()
def final_slip(dispatch_id):
    """Generate a final packing slip PDF."""
    try:
        dispatch = Dispatch.query.get_or_404(dispatch_id)
        pdf_bytes = _build_slip_pdf(dispatch, title="FINAL Packing Slip")

        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f"final_slip_{dispatch.dispatch_number}.pdf"
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@dispatch_bp.route('/<int:dispatch_id>/finalize', methods=['POST'])
@jwt_required()
def finalize_dispatch(dispatch_id):
    """Finalize dispatch - set all products to Dispatched."""
    try:
        dispatch = Dispatch.query.get_or_404(dispatch_id)

        if dispatch.status == 'Dispatched':
            return jsonify({'error': 'Dispatch already finalized'}), 400

        if not dispatch.items:
            return jsonify({'error': 'Cannot finalize empty dispatch'}), 400

        total_weight = 0.0
        for item in dispatch.items:
            product = Product.query.get(item.product_id)
            if product:
                product.status = 'Dispatched'
                total_weight += product.net_weight or 0

        dispatch.status = 'Dispatched'
        dispatch.total_items = len(dispatch.items)
        dispatch.total_weight = round(total_weight, 2)

        db.session.commit()

        return jsonify({
            'message': 'Dispatch finalized',
            'dispatch': dispatch.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@dispatch_bp.route('/<int:dispatch_id>/sheet', methods=['GET'])
@jwt_required()
def dispatch_sheet(dispatch_id):
    """Generate and return a dispatch sheet PDF."""
    try:
        dispatch = Dispatch.query.get_or_404(dispatch_id)
        pdf_bytes = _build_slip_pdf(dispatch, title="Dispatch Sheet")

        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f"dispatch_sheet_{dispatch.dispatch_number}.pdf"
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500
