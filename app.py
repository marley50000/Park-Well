from flask import Flask, render_template, jsonify, request, session, redirect, url_for
import json
import os
import time
import math
from functools import wraps
from flask_socketio import SocketIO, emit
import uuid

app = Flask(__name__)
app.secret_key = 'parkwell_secret_key_ghana_living_legends' # Change in production
socketio = SocketIO(app, cors_allowed_origins="*")

DATA_FILE = 'parking_data.json'
TRANSACTIONS_FILE = 'transactions.json'

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

# --- Helpers ---
def load_data():
    return MEM_DATA

def save_data(data):
    global MEM_DATA
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
            return redirect(url_for('dashboard'))
        else:
            return render_template('login.html', error="Invalid credentials")
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.pop('admin', None)
    return redirect(url_for('login'))

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html', is_admin=('admin' in session))

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
    if 'admin' not in session:
        return jsonify({'message': 'Unauthorized'}), 401
        
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
    
    # Trust Level
    new_spot['trust_level'] = int(new_spot.get('trust_level', 3))
    new_spot['image_url'] = new_spot.get('image_url', '') # Media URL
    
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
    if 'admin' not in session:
        return jsonify({'message': 'Unauthorized'}), 401

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
            
            if 'trust_level' in updated_info and updated_info['trust_level']:
                 spot['trust_level'] = int(updated_info['trust_level'])
            
            save_data(data)
            
            # Broadcast update
            socketio.emit('data_update', {'type': 'spot_updated'})
            
            return jsonify({'success': True, 'spot': spot})
    
    return jsonify({'success': False, 'message': 'Spot not found'}), 404

@app.route('/api/spots/<int:spot_id>', methods=['DELETE'])
def delete_spot(spot_id):
    if 'admin' not in session:
        return jsonify({'message': 'Unauthorized'}), 401
        
    data = load_data()
    data = [s for s in data if s['id'] != spot_id]
    save_data(data)
    
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

    return jsonify({'success': False, 'message': 'Spot not found'}), 404

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

if __name__ == '__main__':
    socketio.run(app, debug=True, port=5000)
