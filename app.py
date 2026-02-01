from flask import Flask, render_template, jsonify, request, session, redirect, url_for
import json
import os
import time
from functools import wraps
from flask_socketio import SocketIO, emit

app = Flask(__name__)
app.secret_key = 'parkwell_secret_key_ghana_living_legends' # Change in production
socketio = SocketIO(app, cors_allowed_origins="*")

DATA_FILE = 'parking_data.json'
TRANSACTIONS_FILE = 'transactions.json'

# --- Helpers ---
def load_data():
    if not os.path.exists(DATA_FILE):
        return []
    with open(DATA_FILE, 'r') as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2)

def load_transactions():
    if not os.path.exists(TRANSACTIONS_FILE):
        return []
    with open(TRANSACTIONS_FILE, 'r') as f:
        return json.load(f)

def save_transaction(transaction):
    transactions = load_transactions()
    transactions.append(transaction)
    with open(TRANSACTIONS_FILE, 'w') as f:
        json.dump(transactions, f, indent=2)

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
@login_required
def dashboard():
    return render_template('dashboard.html')

# --- API ---
@app.route('/api/spots', methods=['GET'])
def get_spots():
    return jsonify(load_data())

@app.route('/api/spots', methods=['POST'])
def add_spot():
    if 'admin' not in session:
        return jsonify({'message': 'Unauthorized'}), 401
        
    data = load_data()
    new_spot = request.json
    new_spot['id'] = max([item['id'] for item in data] + [0]) + 1
    new_spot['lat'] = float(new_spot['lat'])
    new_spot['lng'] = float(new_spot['lng'])
    new_spot['price'] = float(new_spot['price'])
    new_spot['available'] = int(new_spot['available'])
    new_spot['distance'] = "0.5 km" # Default mocked distance
    
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

@app.route('/receipt/<int:txn_id>')
def view_receipt(txn_id):
    transactions = load_transactions()
    txn = next((t for t in transactions if t['id'] == txn_id), None)
    if not txn:
        return "Receipt not found", 404
    return render_template('receipt.html', txn=txn)

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
