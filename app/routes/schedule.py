from datetime import datetime, timedelta, timezone
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app import db
from app.models import ProductionRun

schedule_bp = Blueprint('schedule', __name__)


@schedule_bp.route('', methods=['GET'])
@jwt_required()
def get_schedule():
    """Get production schedule grouped by date."""
    try:
        start = request.args.get('start')
        end = request.args.get('end')
        status = request.args.get('status')

        query = ProductionRun.query

        if start:
            query = query.filter(ProductionRun.run_date >= datetime.strptime(start, '%Y-%m-%d').date())
        if end:
            query = query.filter(ProductionRun.run_date <= datetime.strptime(end, '%Y-%m-%d').date())
        if status:
            query = query.filter(ProductionRun.status == status)

        runs = query.order_by(ProductionRun.run_date.asc(), ProductionRun.shaft_number.asc()).all()

        # Group by date
        by_date = {}
        for run in runs:
            date_str = run.run_date.isoformat()
            if date_str not in by_date:
                by_date[date_str] = {
                    'date': date_str,
                    'runs': [],
                    'total_shafts': 0,
                    'avg_utilization': 0,
                }
            by_date[date_str]['runs'].append(run.to_dict())
            by_date[date_str]['total_shafts'] += 1

        # Calculate averages
        for date_data in by_date.values():
            utils = [r['utilization_pct'] for r in date_data['runs']]
            date_data['avg_utilization'] = round(sum(utils) / len(utils), 1) if utils else 0

        schedule = sorted(by_date.values(), key=lambda d: d['date'])

        return jsonify({'schedule': schedule, 'total_days': len(schedule)}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@schedule_bp.route('/summary', methods=['GET'])
@jwt_required()
def schedule_summary():
    """Get high-level schedule summary."""
    try:
        today = datetime.now(timezone.utc).date()

        total_planned = ProductionRun.query.filter(ProductionRun.status == 'Planned').count()
        total_in_progress = ProductionRun.query.filter(ProductionRun.status == 'In Progress').count()
        total_completed = ProductionRun.query.filter(ProductionRun.status == 'Completed').count()

        today_runs = ProductionRun.query.filter(ProductionRun.run_date == today).count()

        upcoming = ProductionRun.query.filter(
            ProductionRun.run_date > today,
            ProductionRun.status == 'Planned'
        ).count()

        return jsonify({
            'total_planned': total_planned,
            'total_in_progress': total_in_progress,
            'total_completed': total_completed,
            'today_runs': today_runs,
            'upcoming': upcoming,
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
