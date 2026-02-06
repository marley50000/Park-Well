from flask import Flask, render_template, jsonify, request, session, redirect, url_for
import json
import os
import time
import math
from functools import wraps
from flask_socketio import SocketIO, emit
import uuid
from dotenv import load_dotenv
import requests

load_dotenv()

# --- Config & Supabase Lite (No SDK Required) ---
class SupabaseLite:
    def __init__(self, url, key):
        self.url = url.rstrip('/')
        self.key = key
        self.headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }
        self.auth = AuthLite(self)

    def table(self, name):
        return TableLite(self, name)

class AuthLite:
    def __init__(self, client):
        self.client = client
    
    def sign_up(self, credentials):
        try:
            r = requests.post(f"{self.client.url}/auth/v1/signup", 
                            json=credentials, headers=self.client.headers)
            # Supabase returns 200 on success, or error
            if r.status_code == 200:
                data = r.json()
                return AuthResponse(data.get('user'), error=None)
            return AuthResponse(None, error=r.json().get('msg', 'Signup failed'))
        except Exception as e:
            return AuthResponse(None, error=str(e))

    def sign_in_with_password(self, credentials):
        try:
            r = requests.post(f"{self.client.url}/auth/v1/token?grant_type=password", 
                            json=credentials, headers=self.client.headers)
            if r.status_code == 200:
                data = r.json()
                return AuthResponse(data.get('user'), error=None)
            return AuthResponse(None, error=r.json().get('error_description', 'Login failed'))
        except Exception as e:
            return AuthResponse(None, error=str(e))

class AuthResponse:
    def __init__(self, user, error=None):
        self.user = user
        self.error = error

class TableLite:
    def __init__(self, client, name):
        self.client = client
        self.endpoint = f"{client.url}/rest/v1/{name}"
        self.params = {}
        self.json_data = None
        self.method = 'GET'

    def select(self, columns="*"):
        self.method = 'GET'
        self.params['select'] = columns
        return self

    def insert(self, data):
        self.method = 'POST'
        self.json_data = data
        return self

    def update(self, data):
        self.method = 'PATCH'
        self.json_data = data
        return self

    def delete(self):
        self.method = 'DELETE'
        return self

    def eq(self, column, value):
        self.params[f"{column}"] = f"eq.{value}"
        return self
    
    def order(self, column, desc=False):
        direction = 'desc' if desc else 'asc'
        self.params['order'] = f"{column}.{direction}"
        return self

    def execute(self):
        try:
            if self.method == 'GET':
                r = requests.get(self.endpoint, headers=self.client.headers, params=self.params)
            elif self.method == 'POST':
                r = requests.post(self.endpoint, headers=self.client.headers, params=self.params, json=self.json_data)
            elif self.method == 'PATCH':
                r = requests.patch(self.endpoint, headers=self.client.headers, params=self.params, json=self.json_data)
            elif self.method == 'DELETE':
                r = requests.delete(self.endpoint, headers=self.client.headers, params=self.params)
            
            if r.status_code >= 400:
                print(f"Supabase Error {r.status_code}: {r.text}")
                return APIResponse(None)
                
            data = r.json() if r.text and 'application/json' in r.headers.get('Content-Type', '') else []
            return APIResponse(data)
        except Exception as e:
            print(f"Request Error: {e}")
            return APIResponse(None)

class APIResponse:
    def __init__(self, data):
        self.data = data

# --- App Init ---
app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'parkwell_secret_key_ghana_living_legends')

# Init Client
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")

if not url or not key:
    print("WARNING: Supabase credentials not found. DB calls will fail.")
    supabase = None
else:
    supabase = SupabaseLite(url, key)

socketio = SocketIO(app, cors_allowed_origins="*")

UNDO_STACK = []
REDO_STACK = []
MAX_HISTORY = 20

# --- Database Help ---
def get_user_by_id(uid):
    if not supabase: return None
    res = supabase.table('users').select("*").eq('id', uid).execute()
    return res.data[0] if res.data else None

def create_public_user(user_data):
    if not supabase: return
    supabase.table('users').insert(user_data).execute()

# (Reusing previous CRUD helpers)
def get_all_spots():
    if not supabase: return []
    res = supabase.table('spots').select("*").order('id').execute()
    return res.data or []

def get_spot_by_id(spot_id):
    if not supabase: return None
    res = supabase.table('spots').select("*").eq('id', spot_id).execute()
    return res.data[0] if res.data else None

def create_spot(spot_data):
    if not supabase: return None
    if 'id' in spot_data: del spot_data['id']
    res = supabase.table('spots').insert(spot_data).execute()
    return res.data[0] if res.data else None

def update_spot(spot_id, updates):
    if not supabase: return None
    return supabase.table('spots').update(updates).eq('id', spot_id).execute()

def delete_spot_db(spot_id):
    if not supabase: return
    supabase.table('spots').delete().eq('id', spot_id).execute()

def get_sessions():
    if not supabase: return []
    res = supabase.table('sessions').select("*").execute()
    return res.data or []

def create_session(session_data):
    if not supabase: return
    supabase.table('sessions').insert(session_data).execute()

def delete_session(spot_id):
    if not supabase: return
    supabase.table('sessions').delete().eq('spot_id', spot_id).execute()

def get_transactions():
    if not supabase: return []
    res = supabase.table('transactions').select("*").order('created_at', desc=True).execute()
    return res.data or []

def create_transaction(txn_data):
    if not supabase: return
    if 'id' in txn_data: del txn_data['id']
    supabase.table('transactions').insert(txn_data).execute()
    
def get_users():
    if not supabase: return []
    res = supabase.table('users').select("*").execute()
    return res.data or []

def update_user(user_id, updates):
    if not supabase: return
    supabase.table('users').update(updates).eq('id', user_id).execute()

def push_undo_snapshot():
    global UNDO_STACK, REDO_STACK
    current = get_all_spots()
    UNDO_STACK.append(current)
    if len(UNDO_STACK) > MAX_HISTORY:
        UNDO_STACK.pop(0)
    REDO_STACK.clear()

def restore_snapshot(snapshot):
    if not supabase: return
    current_ids = {s['id'] for s in get_all_spots()}
    snapshot_ids = {s['id'] for s in snapshot}
    
    for spot in snapshot:
        clean = spot.copy()
        if 'created_at' in clean: del clean['created_at']
        if spot['id'] in current_ids:
            update_spot(spot['id'], clean)
        else:
            create_spot(clean)
            
    for cid in current_ids:
        if cid not in snapshot_ids:
            delete_spot_db(cid)
            
def haversine(lat1, lon1, lat2, lon2):
    R = 6371000
    try:
        phi1 = math.radians(float(lat1))
        phi2 = math.radians(float(lat2))
        dphi = math.radians(float(lat2)-float(lat1))
        dlam = math.radians(float(lon2)-float(lon1))
        a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2)**2
        c = 2*math.atan2(math.sqrt(a),math.sqrt(1-a))
        return R*c
    except: return 9999999

# --- Routes ---

@app.route('/')
def home():
    return render_template('welcome.html')

@app.route('/map')
def map_view():
    pk = os.environ.get('VITE_PAYSTACK_PUBLIC_KEY', 'pk_test_placeholder')
    return render_template('index.html', paystack_key=pk)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username') # Email
        password = request.form.get('password')
        
        # 1. Check Admin Env (Priority)
        admin_emails = os.environ.get('ADMIN_EMAILS', 'admin').split(',')
        if username in admin_emails and password == os.environ.get('ADMIN_PASS', 'password123'):
             session['admin'] = True
             session['user_id'] = 'admin'
             return redirect(url_for('admin_dashboard'))

        # 2. Check Supabase Auth (Users)
        if supabase:
            res = supabase.auth.sign_in_with_password({"email": username, "password": password})
            if res.user:
                session['user_id'] = res.user['id']
                session['user_email'] = res.user['email']
                # Ensure public user record exists
                if not get_user_by_id(res.user['id']):
                    create_public_user({
                        'id': res.user['id'],
                        'name': username.split('@')[0],
                        'wallet_balance': 0.0
                    })
                return redirect(url_for('dashboard'))
            else:
                 error = res.error or "Invalid login"
                 return render_template('login.html', error=error)
        
        return render_template('login.html', error="Login service unavailable")
    return render_template('login.html')

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        
        if supabase:
            res = supabase.auth.sign_up({"email": email, "password": password})
            if res.user:
                # Success - Create Public Record
                uid = res.user['id']
                create_public_user({
                    'id': uid,
                    'name': email.split('@')[0], 
                    'wallet_balance': 0.0,
                    'points': 0,
                    'tier': 'Bronze'
                })
                
                # Verify Logic: Supabase may require email confirm.
                # If 'user' object has 'identities' populated, it usually means "signed up". 
                # If confirmation is required, user can't log in yet. 
                # We'll tell them to check email or login.
                
                return render_template('login.html', success="Account created! Please sign in (check email if required).")
            else:
                return render_template('signup.html', error=res.error or "Signup failed")
    
    return render_template('signup.html')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

@app.route('/dashboard')
def dashboard():
    pk = os.environ.get('VITE_PAYSTACK_PUBLIC_KEY', 'pk_test_placeholder')
    if 'user_id' not in session and 'admin' not in session:
        return redirect(url_for('login'))
    
    is_admin = 'admin' in session
    return render_template('dashboard.html', is_admin=is_admin, paystack_key=pk)

@app.route('/admin/dashboard')
def admin_dashboard():
    if 'admin' not in session: return redirect(url_for('login'))
    pk = os.environ.get('VITE_PAYSTACK_PUBLIC_KEY', 'pk_test_placeholder')
    return render_template('dashboard.html', is_admin=True, paystack_key=pk)

# --- API ---
@app.route('/api/spots', methods=['GET'])
def get_spots():
    return jsonify(get_all_spots())

@app.route('/api/spots', methods=['POST'])
def add_spot():
    push_undo_snapshot()
    new_spot = request.json
    try:
        spot_lat = float(new_spot['lat'])
        spot_lng = float(new_spot['lng'])
    except:
        return jsonify({'message': 'Invalid coordinates'}), 400

    if 'admin' not in session:
        user_lat = new_spot.get('user_lat')
        user_lng = new_spot.get('user_lng')
        if not user_lat or not user_lng: return jsonify({'message': 'Location required'}), 400
        if haversine(spot_lat, spot_lng, user_lat, user_lng) > 100:
            return jsonify({'message': 'Too far away'}), 403

    db_spot = {
        'name': new_spot.get('name', 'Unnamed'),
        'price': float(new_spot.get('price', 0)),
        'available': int(new_spot.get('available', 1)),
        'lat': spot_lat,
        'lng': spot_lng,
        'trust_level': int(new_spot.get('trust_level', 3)),
        'image_url': new_spot.get('image_url', ''),
        'vehicle_type': new_spot.get('vehicle_type', 'car'),
        'amenities': new_spot.get('amenities', []),
        'qr_code_id': f"PW-{str(uuid.uuid4())[:8].upper()}",
        'is_premium': False
    }
    
    if 'admin' in session and new_spot.get('is_premium'):
        db_spot['is_premium'] = True

    # Capture Owner ID
    if 'user_id' in session and session['user_id'] != 'admin':
        db_spot['owner_id'] = session['user_id']
    elif 'admin' in session:
        db_spot['owner_id'] = 'admin'
        
    created = create_spot(db_spot)
    socketio.emit('data_update', {'type': 'spot_added'})
    return jsonify(created), 201

# ... (keep existing code) ...

@app.route('/api/admin/users', methods=['GET'])
def get_all_users_admin():
    if 'admin' not in session: return jsonify({'error': '401'}), 401
    return jsonify(get_users())

@app.route('/api/spots/<int:spot_id>', methods=['PUT'])
def edit_spot(spot_id):
    updates = request.json
    clean = {}
    allowed = ['name', 'price', 'available', 'lat', 'lng', 'amenities', 'trust_level', 'vehicle_type', 'image_url']
    for k in allowed:
        if k in updates: clean[k] = updates[k]
        
    if 'admin' in session and 'is_premium' in updates:
        clean['is_premium'] = updates['is_premium']
        
    update_spot(spot_id, clean)
    socketio.emit('data_update', {'type': 'spot_updated'})
    return jsonify({'success': True})

@app.route('/api/spots/<int:spot_id>', methods=['DELETE'])
def delete_spot(spot_id):
    push_undo_snapshot()
    delete_spot_db(spot_id)
    delete_session(spot_id)
    socketio.emit('data_update', {'type': 'spot_deleted'})
    return jsonify({'success': True})

PAYSTACK_SECRET_KEY = os.environ.get('PAYSTACK_SECRET_KEY')
def verify_paystack(ref):
    if not ref: return False
    try:
        r = requests.get(f"https://api.paystack.co/transaction/verify/{ref}", 
            headers={"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}"})
        if r.status_code == 200 and r.json()['data']['status'] == 'success':
            return r.json()['data']
    except: pass
    return False

@app.route('/api/user/topup', methods=['POST'])
def topup_wallet():
    # Helper: Get current user ID
    uid = session.get('user_id')
    if not uid or uid == 'admin': return jsonify({'message': 'Login required'}), 401
    
    ref = request.json.get('reference')
    data = verify_paystack(ref)
    if not data: return jsonify({'success': False, 'message': 'Failed'}), 400
    
    amt = data['amount'] / 100.0
    user = get_user_by_id(uid)
    
    if user:
        update_user(uid, {'wallet_balance': float(user['wallet_balance']) + amt})
        create_transaction({
            'user_id': uid, 'type': 'Deposit', 'amount': amt, 
            'payment_ref': ref, 'date': time.strftime("%Y-%m-%d"),
            'timestamp': time.time()
        })
        return jsonify({'success': True, 'message': 'Funded'})
    return jsonify({'success': False, 'message': 'User not found'})

@app.route('/api/reserve/<int:spot_id>', methods=['POST'])
def reserve_spot(spot_id):
    info = request.json or {}
    uid = session.get('user_id')
    # Allow anonymous simple bookings if needed, but for "Real Data" we prefer auth
    # For now, if no auth, we fail or use temporary guest logic? 
    # Let's enforce auth for the "Best Secured" request.
    if not uid and 'admin' not in session:
        return jsonify({'message': 'Please login to book'}), 401
    if uid == 'admin': uid = 'admin_placeholder' 

    spot = get_spot_by_id(spot_id)
    if not spot or spot['available'] < 1: return jsonify({'message': 'Unavailable'}), 400
    
    user = get_user_by_id(uid) if uid != 'admin_placeholder' else None
    
    pay_method = info.get('payment_method')
    ref = info.get('payment_reference')
    
    if pay_method == 'wallet':
        if not user: return jsonify({'message': 'User not found'}), 400
        if float(user['wallet_balance']) < spot['price']: return jsonify({'message': 'Funds too low'}), 400
        update_user(uid, {'wallet_balance': float(user['wallet_balance']) - spot['price']})
        ref = f"WALLET-{int(time.time())}"
    else:
        if PAYSTACK_SECRET_KEY and 'sk_test' not in PAYSTACK_SECRET_KEY:
             if not verify_paystack(ref): return jsonify({'message': 'Payment failed'}), 400

    update_spot(spot_id, {'available': spot['available'] - 1})
    
    create_transaction({
        'user_id': uid, 'spot_id': spot_id, 'type': 'Booking',
        'amount': spot['price'], 'spot_name': spot['name'],
        'payment_ref': ref, 'date': time.strftime("%Y-%m-%d"),
        'vehicle_plate': info.get('vehicle_plate'),
        'timestamp': time.time()
    })
    
    create_session({
        'spot_id': spot_id, 'user_name': user['name'] if user else 'Guest',
        'vehicle_plate': info.get('vehicle_plate'),
        'start_time': time.time(),
        'expiry_time': time.time() + (int(info.get('duration', 1)) * 3600),
        'price': spot['price'], 'payment_ref': ref
    })
    
    socketio.emit('data_update', {'type': 'reservation'})
    return jsonify({'success': True})

@app.route('/api/admin/sessions', methods=['GET'])
def get_active_sessions():
    if 'admin' not in session: return jsonify({'error': '401'}), 401
    return jsonify(get_sessions())

@app.route('/api/admin/cancel_booking', methods=['POST'])
def cancel_booking():
    if 'admin' not in session: return jsonify({'error': '401'}), 401
    sid = request.json.get('spot_id')
    spot = get_spot_by_id(sid)
    if spot:
        update_spot(sid, {'available': spot['available'] + 1})
        delete_session(sid)
        socketio.emit('data_update', {'type': 'cancellation'})
        return jsonify({'success': True})
    return jsonify({'error': '404'})

@app.route('/api/admin/undo', methods=['POST'])
def undo():
    if 'admin' not in session: return jsonify({'error': '401'}), 401
    if UNDO_STACK:
        restore_snapshot(UNDO_STACK.pop())
        socketio.emit('data_update', {'type': 'undo'})
        return jsonify({'success': True})
    return jsonify({'success': False})

@app.route('/api/analytics', methods=['GET'])
def analytics():
    if 'admin' not in session: return jsonify({'error': '401'}), 401
    txns = get_transactions()
    return jsonify({
        'revenue': sum(float(x['amount'] or 0) for x in txns),
        'total_bookings': len([t for t in txns if t['type']=='Booking']),
        'recent_activity': txns[:10]
    })

@app.route('/api/user/profile', methods=['GET'])
def profile():
    uid = session.get('user_id')
    if not uid: return jsonify({'error': 'Not logged in'}), 401
    
    u = get_user_by_id(uid)
    if not u:
        # Fallback if somehow missing
        u = {'id': uid, 'name': 'User', 'wallet_balance': 0.0, 'points': 0}
        
    txns = get_transactions()
    u['history'] = [{'action': t['type'], 'amount': t['amount'], 'date': t['date'], 'spot': t.get('spot_name')} 
                    for t in txns if t.get('user_id') == uid]
    return jsonify(u)

@app.route('/qrcode/<int:spot_id>')
def qr(spot_id):
    s = get_spot_by_id(spot_id)
    return render_template('qrcode.html', spot=s) if s else "404", 404

@app.route('/receipt/<int:txn_id>')
def receipt(txn_id):
    txns = get_transactions()
    t = next((x for x in txns if str(x['id']) == str(txn_id)), None)
    return render_template('receipt.html', txn=t) if t else "404", 404

if __name__ == '__main__':
    socketio.run(app, debug=True, port=5000)
