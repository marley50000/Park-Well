from flask import Flask, render_template, jsonify, request, session, redirect, url_for
import json
import os
import time
import math
from functools import wraps
from flask_socketio import SocketIO, emit
import uuid
import copy

# --- Undo/Redo Stacks ---
UNDO_STACK = []
REDO_STACK = []
MAX_HISTORY = 20

app = Flask(__name__)
app.secret_key = 'parkwell_secret_key_ghana_living_legends' # Change in production
socketio = SocketIO(app, cors_allowed_origins="*")


DATA_FILE = 'parking_data.json'
TRANSACTIONS_FILE = 'transactions.json'
SESSIONS_FILE = 'active_sessions.json'
USERS_FILE = 'users.json'

# --- In-Memory Globals (For Vercel/Read-Only Support) ---
# We load these once on startup. Writes update these globals + try to write to disk.
try:
    with open(DATA_FILE, 'r') as f:
        MEM_DATA = json.load(f)
except:
    MEM_DATA = []

try:
    with open(TRANSACTIONS_FILE, 'r') as f:
        MEM_TRANSACTIONS = json.load(f)
except:
    MEM_TRANSACTIONS = []

try:
    with open(SESSIONS_FILE, 'r') as f:
        MEM_SESSIONS = json.load(f)
except:
    MEM_SESSIONS = []

try:
    with open(USERS_FILE, 'r') as f:
        MEM_USERS = json.load(f)
except:
    # Default Demo User
    MEM_USERS = [{
        'id': 'user_123', 
        'name': 'Alex Driver', 
        'points': 120, 
        'tier': 'Bronze',
        'history': []
    }]

# --- Helpers ---
def load_data():
    # Return a deep copy so routes don't mutate global state in-place before saving
    return copy.deepcopy(MEM_DATA)

def save_data(data, push_history=True):
    global MEM_DATA, UNDO_STACK, REDO_STACK
    
    if push_history:
        UNDO_STACK.append(copy.deepcopy(MEM_DATA))
        if len(UNDO_STACK) > MAX_HISTORY:
            UNDO_STACK.pop(0)
        REDO_STACK.clear() # New action clears redo history
    
    MEM_DATA = data
    try:
        with open(DATA_FILE, 'w') as f:
            json.dump(data, f, indent=2)
    except OSError:
        pass # Ignore read-only file system errors (Vercel)

def load_transactions():
    return MEM_TRANSACTIONS

def save_transaction(transaction):
    global MEM_TRANSACTIONS
    MEM_TRANSACTIONS.append(transaction)
    try:
        with open(TRANSACTIONS_FILE, 'w') as f:
            json.dump(MEM_TRANSACTIONS, f, indent=2)
    except OSError:
        pass

def load_sessions():
    return MEM_SESSIONS

def save_session(session_data):
    global MEM_SESSIONS
    MEM_SESSIONS.append(session_data)
    try:
        with open(SESSIONS_FILE, 'w') as f:
            json.dump(MEM_SESSIONS, f, indent=2)
    except OSError:
        pass

def remove_session(spot_id):
    global MEM_SESSIONS
    MEM_SESSIONS = [s for s in MEM_SESSIONS if s['spot_id'] != spot_id]
    try:
        with open(SESSIONS_FILE, 'w') as f:
            json.dump(MEM_SESSIONS, f, indent=2)
    except OSError:
        pass

def load_users():
    return MEM_USERS

def save_users(users):
    global MEM_USERS
    MEM_USERS = users
    try:
        with open(USERS_FILE, 'w') as f:
            json.dump(MEM_USERS, f, indent=2)
    except OSError:
        pass

def get_tier(points):
    if points >= 1000: return 'Platinum'
    if points >= 500: return 'Gold'
    if points >= 200: return 'Silver'
    return 'Bronze'

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'admin' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

# --- Routes ---
# ... (Keep existing routes same until API) ...
@app.route('/')
def home():
    return render_template('welcome.html')

@app.route('/map')
def map_view():
    return render_template('index.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        if username == 'admin' and password == 'password123':
            session['admin'] = True
            return redirect(url_for('admin_dashboard'))
        else:
            return render_template('login.html', error="Invalid credentials")
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.pop('admin', None)
    return redirect(url_for('login'))

@app.route('/dashboard')
def dashboard():
    # Public/User Dashboard (Always show user view, never admin controls)
    return render_template('dashboard.html', is_admin=False)

@app.route('/admin/dashboard')
def admin_dashboard():
    if 'admin' not in session:
        return redirect(url_for('login'))
    return render_template('dashboard.html', is_admin=True)

# --- API ---
@app.route('/api/spots', methods=['GET'])
def get_spots():
    return jsonify(load_data())

def haversine(lat1, lon1, lat2, lon2):
    R = 6371000  # Radius of Earth in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

@app.route('/api/spots', methods=['POST'])
def add_spot():
    # if 'admin' not in session:
    #     return jsonify({'message': 'Unauthorized'}), 401
    
    # Allow community submissions (Host Mode)
        
    data = load_data()
    new_spot = request.json
    
    # Inputs
    try:
        spot_lat = float(new_spot['lat'])
        spot_lng = float(new_spot['lng'])
    except:
        return jsonify({'message': 'Invalid coordinates'}), 400

    new_spot['id'] = max([item['id'] for item in data] + [0]) + 1
    new_spot['lat'] = spot_lat
    new_spot['lng'] = spot_lng
    new_spot['price'] = float(new_spot['price'])
    new_spot['available'] = int(new_spot['available'])
    new_spot['distance'] = "0.5 km" # Mocked for display
    
    # --- STRICT GPS SECURITY CHECK (Physical Presence) ---
    if 'admin' not in session:
        # User MUST be physically present (within 100m)
        user_lat = new_spot.get('user_lat')
        user_lng = new_spot.get('user_lng')
        
        if user_lat is None or user_lng is None:
            return jsonify({'message': 'Location verification required.\nPlease enable GPS to prove you are at the location.'}), 400
            
        try:
            # We already have haversine function in scope
            dist_meters = haversine(spot_lat, spot_lng, float(user_lat), float(user_lng))
        except:
             return jsonify({'message': 'Invalid user coordinates.'}), 400

        if dist_meters > 100: # 100 meters tolerance
            return jsonify({'message': f'You are too far away ({int(dist_meters)}m).\nYou must be physically present to add this spot.'}), 403
    # -----------------------------------------------------
    
    # Trust Level
    new_spot['trust_level'] = int(new_spot.get('trust_level', 3))
    new_spot['image_url'] = new_spot.get('image_url', '') # Media URL
    
    # Availability Schedule
    new_spot['unavailable_dates'] = new_spot.get('unavailable_dates', [])
    new_spot['unavailable_days'] = new_spot.get('unavailable_days', [])
    new_spot['unavailable_reason'] = new_spot.get('unavailable_reason', '')
    
    # Amenities
    new_spot['amenities'] = new_spot.get('amenities', [])
    
    # --- STRICT GPS SECURITY CHECK ---
    owner_lat = new_spot.get('owner_lat')
    owner_lng = new_spot.get('owner_lng')
    
    # Optional: Logic to verify owner location if strict mode is on
    # For now, we allow it but log it or just proceed
    
    # Generate Unique QR Code ID
    new_spot['qr_code_id'] = f"PW-{str(uuid.uuid4())[:8].upper()}"
    
    data.append(new_spot)
    save_data(data)
    
    # Broadcast update
    socketio.emit('data_update', {'type': 'spot_added'})
    
    return jsonify(new_spot), 201

@app.route('/api/spots/<int:spot_id>', methods=['PUT'])
def edit_spot(spot_id):
    # if 'admin' not in session:
    #     return jsonify({'message': 'Unauthorized'}), 401

    data = load_data()
    updated_info = request.json
    
    for spot in data:
        if spot['id'] == spot_id:
            spot['name'] = updated_info.get('name', spot['name'])
            spot['price'] = float(updated_info.get('price', spot['price']))
            spot['available'] = int(updated_info.get('available', spot['available']))
            spot['lat'] = float(updated_info.get('lat', spot['lat']))
            spot['lng'] = float(updated_info.get('lng', spot['lng']))
            spot['image_url'] = updated_info.get('image_url', spot.get('image_url', ''))
            
            # Availability Schedule
            spot['unavailable_dates'] = updated_info.get('unavailable_dates', spot.get('unavailable_dates', []))
            spot['unavailable_days'] = updated_info.get('unavailable_days', spot.get('unavailable_days', []))
            spot['unavailable_reason'] = updated_info.get('unavailable_reason', spot.get('unavailable_reason', ''))
            
            # Amenities
            spot['amenities'] = updated_info.get('amenities', spot.get('amenities', []))
            
            if 'trust_level' in updated_info and updated_info['trust_level']:
                 spot['trust_level'] = int(updated_info['trust_level'])
            
            save_data(data)
            
            # Broadcast update
            socketio.emit('data_update', {'type': 'spot_updated'})
            
            return jsonify({'success': True, 'spot': spot})
    
    return jsonify({'success': False, 'message': 'Spot not found'}), 404

@app.route('/api/spots/<int:spot_id>', methods=['DELETE'])
def delete_spot(spot_id):
    # if 'admin' not in session:
    #     return jsonify({'message': 'Unauthorized'}), 401
        
    data = load_data()
    data = [s for s in data if s['id'] != spot_id]
    save_data(data)
    
    # Cascade delete: Remove active sessions for this spot
    remove_session(spot_id)
    
    # Broadcast update
    socketio.emit('data_update', {'type': 'spot_deleted'})
    
    return jsonify({'success': True})

@app.route('/api/reserve/<int:spot_id>', methods=['POST'])
def reserve_spot(spot_id):
    data = load_data()
    booking_info = request.json or {}
    
    for spot in data:
        if spot['id'] == spot_id:
            if spot['available'] > 0:
                spot['available'] -= 1
                save_data(data)
                
                # Transaction
                txn = {
                    'id': int(time.time() * 1000),
                    'spot_id': spot_id,
                    'spot_name': spot['name'],
                    'price': spot['price'],
                    'user_name': booking_info.get('user_name', 'Walk-in Customer'),
                    'vehicle_plate': booking_info.get('vehicle_plate', 'Unknown'),
                    'timestamp': time.time()
                }
                save_transaction(txn)
                
                # Active Session
                duration = int(booking_info.get('duration', 1))
                session_obj = {
                    'spot_id': spot_id,
                    'user_name': booking_info.get('user_name', 'Walk-in Customer'),
                    'vehicle_plate': booking_info.get('vehicle_plate', 'Unknown'),
                    'start_time': time.time(),
                    'expiry_time': time.time() + (duration * 3600), # Hours to seconds
                    'price': spot['price']
                }
                save_session(session_obj)

                # --- REWARDS SYSTEM ---
                # Award points (e.g. 10 points per booking + 1 per dollar)
                earned_points = 10 + int(spot['price'])
                
                users = load_users()
                # Assuming single demo user for now
                user = users[0] 
                user['points'] += earned_points
                user['tier'] = get_tier(user['points'])
                user['history'].append({
                    'action': 'Booking',
                    'points': earned_points, 
                    'spot': spot['name'],
                    'date': time.strftime("%Y-%m-%d")
                })
                save_users(users)
                # ----------------------

                # Broadcast update (affects availability and revenue)
                socketio.emit('data_update', {'type': 'reservation'})
                
                return jsonify({
                    'success': True, 
                    'available': spot['available'],
                    'transaction_id': txn['id']
                })
            else:
                return jsonify({'success': False, 'message': 'Spot full'}), 400
    return jsonify({'success': False, 'message': 'Spot not found'}), 404

@app.route('/api/admin/sessions', methods=['GET'])
def get_active_sessions():
    if 'admin' not in session:
        return jsonify({'message': 'Unauthorized'}), 401
    return jsonify(load_sessions())

@app.route('/api/admin/cancel_booking', methods=['POST'])
def cancel_booking():
    if 'admin' not in session:
        return jsonify({'message': 'Unauthorized'}), 401

    data = load_data()
    req = request.json
    spot_id = req.get('spot_id')

    for spot in data:
        if spot['id'] == spot_id:
            # security: simple increment
            spot['available'] += 1
            save_data(data)
            
            # Remove from active sessions
            remove_session(spot_id)

            # Broadcast force end
            socketio.emit('force_end_session', {'spot_id': spot_id, 'message': 'Admin cancelled the session due to an issue.'})
            socketio.emit('data_update', {'type': 'cancellation'})

            return jsonify({'success': True, 'message': 'Session cancelled, spot freed.'})

    # If spot not found, check if we have a zombie session to clean up
    sessions = load_sessions()
    zombie = next((s for s in sessions if s['spot_id'] == spot_id), None)
    if zombie:
        remove_session(spot_id)
        socketio.emit('data_update', {'type': 'cancellation'})
        return jsonify({'success': True, 'message': 'Orphaned session removed.'})

    return jsonify({'success': False, 'message': 'Spot not found'}), 404

@app.route('/api/admin/undo', methods=['POST'])
def undo_action():
    if 'admin' not in session: return jsonify({'message': 'Unauthorized'}), 401
    
    global MEM_DATA, UNDO_STACK, REDO_STACK
    if not UNDO_STACK:
        return jsonify({'success': False, 'message': 'Nothing to undo'})
    
    # Push current to redo
    REDO_STACK.append(copy.deepcopy(MEM_DATA))
    
    # Restore from undo
    prev_state = UNDO_STACK.pop()
    save_data(prev_state, push_history=False) # Don't push to undo stack again
    
    # Broadcast
    socketio.emit('data_update', {'type': 'undo'})
    return jsonify({'success': True, 'message': 'Action undone'})

@app.route('/api/admin/redo', methods=['POST'])
def redo_action():
    if 'admin' not in session: return jsonify({'message': 'Unauthorized'}), 401
    
    global MEM_DATA, UNDO_STACK, REDO_STACK
    if not REDO_STACK:
        return jsonify({'success': False, 'message': 'Nothing to redo'})
        
    # Push current to undo as if it's a new action (but we orchestrate it)
    UNDO_STACK.append(copy.deepcopy(MEM_DATA))
    
    # Restore from redo
    next_state = REDO_STACK.pop()
    save_data(next_state, push_history=False)
    
    socketio.emit('data_update', {'type': 'redo'})
    return jsonify({'success': True, 'message': 'Action redone'})

@app.route('/receipt/<int:txn_id>')
def view_receipt(txn_id):
    transactions = load_transactions()
    txn = next((t for t in transactions if t['id'] == txn_id), None)
    if not txn:
        return "Receipt not found", 404
    return render_template('receipt.html', txn=txn)

@app.route('/qrcode/<int:spot_id>')
def print_qr(spot_id):
    if 'admin' not in session:
        return redirect(url_for('login'))
        
    data = load_data()
    spot = next((s for s in data if s['id'] == spot_id), None)
    if not spot:
        return "Spot not found", 404
    
    # Ensure QR ID exists for older data
    if 'qr_code_id' not in spot:
        spot['qr_code_id'] = f"PW-{str(uuid.uuid4())[:8].upper()}"
        save_data(data)
        
    return render_template('qrcode.html', spot=spot)

@app.route('/api/analytics', methods=['GET'])
def get_analytics():
    if 'admin' not in session:
        return jsonify({'message': 'Unauthorized'}), 401
        
    transactions = load_transactions()
    total_revenue = sum(t['price'] for t in transactions)
    recent_transactions = sorted(transactions, key=lambda x: x['timestamp'], reverse=True)[:10]
    
    return jsonify({
        'revenue': total_revenue,
        'total_bookings': len(transactions),
        'recent_activity': recent_transactions
    })

@app.route('/api/user/profile', methods=['GET'])
def get_user_profile():
    # Return the demo user
    return jsonify(load_users()[0])

if __name__ == '__main__':
    socketio.run(app, debug=True, port=5000)
