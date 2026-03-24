from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required
from app import db
from app.models import Order, OrderItem, ProductionRun, RunItem
from app.services.bin_packing import pack_rolls_into_shafts, optimize_by_color_grouping, get_packing_summary
from app.services.scheduler import schedule_production

planning_bp = Blueprint('planning', __name__)


@planning_bp.route('/preview', methods=['POST'])
@jwt_required()
def preview_plan():
    """Preview production plan without saving. Accepts order IDs to plan."""
    try:
        data = request.get_json()
        order_ids = data.get('order_ids', [])
        group_by_color = data.get('group_by_color', False)
        shaft_width = current_app.config.get('SHAFT_WIDTH_MM', 3200)

        if not order_ids:
            # Plan all pending orders
            orders = Order.query.filter(Order.status.in_(['Pending', 'In Progress'])).all()
        else:
            orders = Order.query.filter(Order.id.in_(order_ids)).all()

        # Gather all unplanned order items
        roll_requests = []
        for order in orders:
            for item in order.items:
                remaining = item.rolls_needed - sum(ri.rolls_count for ri in item.run_items)
                if remaining > 0:
                    roll_requests.append({
                        'order_item_id': item.id,
                        'width_mm': item.width_mm,
                        'rolls_needed': remaining,
                        'color': item.color,
                        'customer_name': order.customer_name,
                        'gsm': item.gsm,
                        'quality_code': item.quality_code,
                    })

        if not roll_requests:
            return jsonify({'message': 'No items to plan', 'shafts': [], 'summary': get_packing_summary([])}), 200

        # Run bin packing
        if group_by_color:
            shaft_plans = optimize_by_color_grouping(roll_requests, shaft_width)
        else:
            shaft_plans = pack_rolls_into_shafts(roll_requests, shaft_width)

        summary = get_packing_summary(shaft_plans)

        return jsonify({
            'shafts': shaft_plans,
            'summary': summary,
            'order_count': len(orders),
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@planning_bp.route('/generate', methods=['POST'])
@jwt_required()
def generate_plan():
    """Generate and save production runs from plan."""
    try:
        data = request.get_json()
        order_ids = data.get('order_ids', [])
        group_by_color = data.get('group_by_color', False)
        start_date = data.get('start_date')
        max_per_day = data.get('max_shafts_per_day', 10)
        shaft_width = current_app.config.get('SHAFT_WIDTH_MM', 3200)

        if not order_ids:
            orders = Order.query.filter(Order.status.in_(['Pending', 'In Progress'])).all()
        else:
            orders = Order.query.filter(Order.id.in_(order_ids)).all()

        # Gather roll requests
        roll_requests = []
        for order in orders:
            for item in order.items:
                remaining = item.rolls_needed - sum(ri.rolls_count for ri in item.run_items)
                if remaining > 0:
                    roll_requests.append({
                        'order_item_id': item.id,
                        'width_mm': item.width_mm,
                        'rolls_needed': remaining,
                        'color': item.color,
                        'customer_name': order.customer_name,
                        'gsm': item.gsm,
                        'quality_code': item.quality_code,
                    })

        if not roll_requests:
            return jsonify({'message': 'No items to plan', 'runs': []}), 200

        # Bin pack
        if group_by_color:
            shaft_plans = optimize_by_color_grouping(roll_requests, shaft_width)
        else:
            shaft_plans = pack_rolls_into_shafts(roll_requests, shaft_width)

        # Schedule
        scheduled = schedule_production(shaft_plans, start_date, max_per_day)

        # Save to database
        created_runs = []
        from datetime import datetime
        for plan in scheduled:
            run = ProductionRun(
                run_date=datetime.strptime(plan['run_date'], '%Y-%m-%d').date(),
                shaft_number=plan.get('shaft_number', 1),
                total_width_used_mm=plan['total_width_used'],
                trim_loss_mm=plan['trim_loss'],
            )
            db.session.add(run)
            db.session.flush()

            for item in plan['items']:
                run_item = RunItem(
                    production_run_id=run.id,
                    order_item_id=item['order_item_id'],
                    rolls_count=item['rolls_count'],
                    width_mm=item['width_mm'],
                    color=item.get('color', 'White'),
                    customer_name=item.get('customer_name', ''),
                )
                db.session.add(run_item)

            created_runs.append(run)

        # Update order statuses
        for order in orders:
            order.status = 'Planned'
        for order in orders:
            for item in order.items:
                produced = sum(ri.rolls_count for ri in item.run_items)
                if produced >= item.rolls_needed:
                    item.status = 'Planned'

        db.session.commit()

        return jsonify({
            'message': f'Created {len(created_runs)} production runs',
            'runs': [r.to_dict() for r in created_runs],
            'summary': get_packing_summary(shaft_plans),
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@planning_bp.route('/runs', methods=['GET'])
@jwt_required()
def list_runs():
    """List production runs with optional filters."""
    try:
        status = request.args.get('status')
        date = request.args.get('date')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)

        query = ProductionRun.query

        if status:
            query = query.filter(ProductionRun.status == status)
        if date:
            from datetime import datetime
            query = query.filter(ProductionRun.run_date == datetime.strptime(date, '%Y-%m-%d').date())

        query = query.order_by(ProductionRun.run_date.asc(), ProductionRun.shaft_number.asc())
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        return jsonify({
            'runs': [r.to_dict() for r in pagination.items],
            'total': pagination.total,
            'page': pagination.page,
            'pages': pagination.pages,
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@planning_bp.route('/runs/<int:run_id>', methods=['PUT'])
@jwt_required()
def update_run(run_id):
    """Update production run status."""
    try:
        run = ProductionRun.query.get_or_404(run_id)
        data = request.get_json()

        if 'status' in data:
            run.status = data['status']
            # If completed, update order item statuses
            if data['status'] == 'Completed':
                for ri in run.run_items:
                    oi = ri.order_item
                    if oi:
                        produced = sum(r.rolls_count for r in oi.run_items if r.production_run.status == 'Completed')
                        if produced >= oi.rolls_needed:
                            oi.status = 'Produced'
                        # Check if entire order is done
                        order = oi.order
                        if order and all(i.status == 'Produced' for i in order.items):
                            order.status = 'Completed'

        if 'notes' in data:
            run.notes = data['notes']

        db.session.commit()
        return jsonify({'run': run.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@planning_bp.route('/runs/<int:run_id>', methods=['DELETE'])
@jwt_required()
def delete_run(run_id):
    """Delete a production run."""
    try:
        run = ProductionRun.query.get_or_404(run_id)
        db.session.delete(run)
        db.session.commit()
        return jsonify({'message': 'Run deleted'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@planning_bp.route('/clear', methods=['POST'])
@jwt_required()
def clear_plans():
    """Clear all planned (not completed) production runs."""
    try:
        runs = ProductionRun.query.filter(ProductionRun.status == 'Planned').all()
        count = len(runs)
        for run in runs:
            db.session.delete(run)

        # Reset order statuses back to Pending
        orders = Order.query.filter(Order.status == 'Planned').all()
        for order in orders:
            has_completed = any(
                ri.production_run.status == 'Completed'
                for item in order.items
                for ri in item.run_items
            )
            if not has_completed:
                order.status = 'Pending'
                for item in order.items:
                    item.status = 'Pending'

        db.session.commit()
        return jsonify({'message': f'Cleared {count} planned runs'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
