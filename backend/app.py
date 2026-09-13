import os
import sqlite3
import json
from flask import Flask, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit, join_room
from werkzeug.utils import secure_filename
from config import Config

try:
    import boto3
    from botocore.config import Config as BotoConfig
    BOTO3_AVAILABLE = True
except ImportError:
    BOTO3_AVAILABLE = False

frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app = Flask(__name__, static_folder=frontend_dir, static_url_path="")
app.config.from_object(Config)

socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="threading",
    ping_timeout=60,
    ping_interval=25,
    logger=False,
    engineio_logger=False
)

DB_FILE = os.path.join(os.path.dirname(__file__), "chat.db")
PRIVATE_ROOM = "exclusive_couple_chamber"
connected_users = {}

def get_b2_client():
    key_id = getattr(Config, "B2_KEY_ID", None)
    app_key = getattr(Config, "B2_APPLICATION_KEY", None)
    endpoint = getattr(Config, "B2_ENDPOINT_URL", "https://s3.us-east-005.backblazeb2.com")

    if not key_id or key_id == "YOUR_B2_KEY_ID" or not app_key:
        return None

    try:
        return boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=key_id,
            aws_secret_access_key=app_key,
            config=BotoConfig(signature_version="s3v4")
        )
    except Exception as e:
        print(f"[B2 Error] {e}")
        return None

def sync_db_from_b2():
    s3 = get_b2_client()
    bucket = getattr(Config, "B2_BUCKET_NAME", "")
    if s3 and bucket and bucket != "your-chat-bucket":
        try:
            s3.download_file(bucket, "chat.db", DB_FILE)
            print("[B2 Sync] Downloaded chat.db from Backblaze B2.")
        except Exception as e:
            print(f"[B2 Sync Info] Using local DB: {e}")

def backup_db_to_b2():
    s3 = get_b2_client()
    bucket = getattr(Config, "B2_BUCKET_NAME", "")
    if s3 and bucket and bucket != "your-chat-bucket":
        try:
            s3.upload_file(DB_FILE, bucket, "chat.db")
        except Exception as e:
            print(f"[B2 Backup Error] {e}")

sync_db_from_b2()

def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            sender TEXT,
            text_content TEXT DEFAULT '',
            timestamp TEXT,
            msg_type TEXT DEFAULT 'text',
            media_url TEXT DEFAULT '',
            caption TEXT DEFAULT '',
            is_view_once INTEGER DEFAULT 0,
            viewed INTEGER DEFAULT 0,
            is_highlighted INTEGER DEFAULT 0,
            reply_to_id TEXT DEFAULT '',
            reply_to_text TEXT DEFAULT '',
            is_edited INTEGER DEFAULT 0
        )
    """)
    conn.commit()

    c.execute("PRAGMA table_info(messages)")
    cols = [col[1] for col in c.fetchall()]
    
    needed_columns = {
        "text_content": "TEXT DEFAULT ''",
        "msg_type": "TEXT DEFAULT 'text'",
        "media_url": "TEXT DEFAULT ''",
        "caption": "TEXT DEFAULT ''",
        "is_view_once": "INTEGER DEFAULT 0",
        "viewed": "INTEGER DEFAULT 0",
        "is_highlighted": "INTEGER DEFAULT 0",
        "reply_to_id": "TEXT DEFAULT ''",
        "reply_to_text": "TEXT DEFAULT ''",
        "is_edited": "INTEGER DEFAULT 0"
    }

    for col_name, col_def in needed_columns.items():
        if col_name not in cols:
            c.execute(f"ALTER TABLE messages ADD COLUMN {col_name} {col_def}")

    conn.commit()
    conn.close()

init_db()

@app.after_request
def after_request(response):
    response.headers.add("Access-Control-Allow-Origin", "*")
    response.headers.add("Access-Control-Allow-Headers", "Content-Type,Authorization")
    response.headers.add("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS")
    return response

@app.route("/")
def index():
    return send_from_directory(frontend_dir, "index.html")

@app.route("/uploads/<filename>")
def serve_upload(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

@app.route("/api/login", methods=["POST", "OPTIONS"])
def login():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    data = request.get_json(silent=True) or {}
    username = data.get("username")
    password = data.get("password")

    accounts = getattr(Config, "ACCOUNTS", {})
    if username in accounts and accounts[username] == password:
        return jsonify({"success": True, "user": username}), 200

    return jsonify({"success": False, "error": "Invalid username or password"}), 401

@app.route("/api/admin-login", methods=["POST", "OPTIONS"])
def admin_login():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    data = request.get_json(silent=True) or {}
    password = data.get("password")
    admin_pw = getattr(Config, "ADMIN_PASSWORD", "onetime@2010")

    if password != admin_pw:
        return jsonify({"success": False, "error": "Incorrect admin password"}), 401

    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute("""
            SELECT id, sender, msg_type, media_url, timestamp, viewed, caption 
            FROM messages 
            WHERE is_view_once = 1 
            ORDER BY rowid DESC
        """)
        rows = c.fetchall()
        conn.close()

        vault = [
            {
                "id": str(r[0]),
                "sender": str(r[1]),
                "msg_type": str(r[2]),
                "media_url": str(r[3]),
                "timestamp": str(r[4]),
                "viewed": bool(r[5]),
                "caption": str(r[6]) if len(r) > 6 and r[6] else ""
            }
            for r in rows
        ]
        return jsonify({"success": True, "vault": vault}), 200
    except Exception as e:
        return jsonify({"success": False, "error": f"Database error: {str(e)}"}), 500

@app.route("/api/admin/delete", methods=["POST", "OPTIONS"])
def admin_delete():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    data = request.get_json(silent=True) or {}
    password = data.get("password")
    msg_id = data.get("id")
    admin_pw = getattr(Config, "ADMIN_PASSWORD", "onetime@2010")

    if password != admin_pw or not msg_id:
        return jsonify({"success": False, "error": "Unauthorized"}), 401

    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute("SELECT media_url FROM messages WHERE id = ?", (msg_id,))
        row = c.fetchone()
        if row and row[0]:
            filename = os.path.basename(row[0])
            local_file = os.path.join(UPLOAD_FOLDER, filename)
            if os.path.exists(local_file):
                try:
                    os.remove(local_file)
                except Exception:
                    pass
            s3 = get_b2_client()
            bucket = getattr(Config, "B2_BUCKET_NAME", "")
            if s3 and bucket:
                try:
                    s3.delete_object(Bucket=bucket, Key=filename)
                except Exception:
                    pass

        c.execute("DELETE FROM messages WHERE id = ?", (msg_id,))
        conn.commit()
        conn.close()

        backup_db_to_b2()
        socketio.emit("message_deleted", {"id": msg_id}, room=PRIVATE_ROOM)
        return jsonify({"success": True}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/upload", methods=["POST"])
def upload_file():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    filename = f"{int(os.times().system * 1000)}_{secure_filename(file.filename)}"
    local_path = os.path.join(UPLOAD_FOLDER, filename)
    file.save(local_path)

    media_url = f"/uploads/{filename}"

    s3 = get_b2_client()
    bucket = getattr(Config, "B2_BUCKET_NAME", "")
    endpoint = getattr(Config, "B2_ENDPOINT_URL", "")

    if s3 and bucket and bucket != "your-chat-bucket":
        try:
            s3.upload_file(
                local_path,
                bucket,
                filename,
                ExtraArgs={"ContentType": file.content_type or "application/octet-stream"}
            )
            clean_endpoint = endpoint.rstrip("/")
            media_url = f"{clean_endpoint}/{bucket}/{filename}"
        except Exception as e:
            print(f"[B2 Upload Warning] {e}")

    return jsonify({"url": media_url}), 200

@app.route("/api/messages", methods=["GET"])
def get_messages():
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute("""
            SELECT id, sender, text_content, timestamp, msg_type, media_url, caption, 
                   is_view_once, viewed, is_highlighted, reply_to_id, reply_to_text, is_edited 
            FROM messages 
            ORDER BY rowid ASC
        """)
        rows = c.fetchall()
        conn.close()

        history = [
            {
                "id": str(r[0]),
                "sender": str(r[1]),
                "text": str(r[2]),
                "timestamp": str(r[3]),
                "msg_type": str(r[4]),
                "media_url": str(r[5]),
                "caption": str(r[6]),
                "is_view_once": bool(r[7]),
                "viewed": bool(r[8]),
                "is_highlighted": bool(r[9]),
                "reply_to_id": str(r[10] or ""),
                "reply_to_text": str(r[11] or ""),
                "is_edited": bool(r[12])
            }
            for r in rows
        ]
        return jsonify(history), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/storage-info", methods=["GET"])
def storage_info():
    try:
        s3 = get_b2_client()
        bucket = getattr(Config, "B2_BUCKET_NAME", "")

        if not s3 or not bucket or bucket == "your-chat-bucket":
            total_bytes = sum(
                os.path.getsize(os.path.join(UPLOAD_FOLDER, f))
                for f in os.listdir(UPLOAD_FOLDER)
                if os.path.isfile(os.path.join(UPLOAD_FOLDER, f))
            )
            total_mb = round(total_bytes / (1024 * 1024), 2)
            return jsonify({
                "used_mb": total_mb,
                "free_limit_mb": 10240,
                "used_pct": round((total_mb / 10240) * 100, 2)
            }), 200

        response = s3.list_objects_v2(Bucket=bucket)
        total_bytes = sum(item["Size"] for item in response.get("Contents", []))
        total_mb = round(total_bytes / (1024 * 1024), 2)
        return jsonify({
            "used_mb": total_mb,
            "free_limit_mb": 10240,
            "used_pct": round((total_mb / 10240) * 100, 2)
        }), 200
    except Exception as e:
        return jsonify({"used_mb": 0.0, "free_limit_mb": 10240, "used_pct": 0.0, "error": str(e)}), 200

@socketio.on("connect")
def handle_connect():
    username = request.args.get("user")
    accounts = getattr(Config, "ACCOUNTS", {})

    if username and username in accounts:
        connected_users[request.sid] = username
        join_room(PRIVATE_ROOM)
        emit("user_status", {
            "user": username,
            "status": "online",
            "online_users": list(set(connected_users.values()))
        }, room=PRIVATE_ROOM)
    else:
        return False

@socketio.on("disconnect")
def handle_disconnect():
    if request.sid in connected_users:
        username = connected_users.pop(request.sid)
        emit("user_status", {
            "user": username,
            "status": "offline",
            "online_users": list(set(connected_users.values()))
        }, room=PRIVATE_ROOM)

@socketio.on("send_encrypted_message")
def handle_message(payload):
    sender = connected_users.get(request.sid) or payload.get("sender")
    if not sender:
        return

    msg_id = str(payload.get("id"))
    text = str(payload.get("text", ""))
    timestamp = str(payload.get("timestamp", ""))
    msg_type = str(payload.get("msg_type", "text"))
    media_url = str(payload.get("media_url", ""))
    caption = str(payload.get("caption", ""))
    is_view_once = 1 if payload.get("is_view_once") else 0
    reply_to_id = str(payload.get("reply_to_id", ""))
    reply_to_text = str(payload.get("reply_to_text", ""))

    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute("""
            INSERT OR REPLACE INTO messages (
                id, sender, text_content, timestamp, msg_type, media_url, caption, 
                is_view_once, viewed, is_highlighted, reply_to_id, reply_to_text, is_edited
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, 0)
        """, (msg_id, sender, text, timestamp, msg_type, media_url, caption, is_view_once, reply_to_id, reply_to_text))
        conn.commit()
        conn.close()
        backup_db_to_b2()
    except Exception as e:
        print(f"[DB Error] {e}")

    payload["sender"] = sender
    emit("receive_encrypted_message", payload, room=PRIVATE_ROOM, include_self=False)

@socketio.on("edit_message")
def handle_edit(data):
    msg_id = data.get("id")
    new_text = data.get("text", "").strip()
    sender = connected_users.get(request.sid)

    if not msg_id or not new_text or not sender:
        return

    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute("""
            UPDATE messages 
            SET text_content = ?, is_edited = 1 
            WHERE id = ? AND sender = ? AND msg_type = 'text'
        """, (new_text, msg_id, sender))
        affected = c.rowcount
        conn.commit()
        conn.close()

        if affected > 0:
            backup_db_to_b2()
            emit("message_edited", {"id": msg_id, "text": new_text}, room=PRIVATE_ROOM)
    except Exception as e:
        print(f"[Edit Error] {e}")

@socketio.on("highlight_message")
def handle_highlight(data):
    msg_id = data.get("id")
    is_highlighted = 1 if data.get("is_highlighted") else 0

    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute("UPDATE messages SET is_highlighted = ? WHERE id = ?", (is_highlighted, msg_id))
        conn.commit()
        conn.close()
        backup_db_to_b2()
        emit("message_highlighted", {"id": msg_id, "is_highlighted": bool(is_highlighted)}, room=PRIVATE_ROOM)
    except Exception as e:
        print(f"[Highlight Error] {e}")

@socketio.on("view_once_opened")
def handle_view_once_opened(data):
    msg_id = data.get("id")
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("UPDATE messages SET viewed = 1 WHERE id = ?", (msg_id,))
    conn.commit()
    conn.close()
    backup_db_to_b2()
    emit("view_once_consumed", {"id": msg_id}, room=PRIVATE_ROOM)

@socketio.on("delete_message")
def handle_delete(data):
    msg_id = data.get("id")
    sender = connected_users.get(request.sid)

    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("SELECT media_url FROM messages WHERE id = ? AND sender = ?", (msg_id, sender))
    row = c.fetchone()
    if row and row[0]:
        filename = os.path.basename(row[0])
        local_file = os.path.join(UPLOAD_FOLDER, filename)
        if os.path.exists(local_file):
            try:
                os.remove(local_file)
            except Exception:
                pass
        s3 = get_b2_client()
        bucket = getattr(Config, "B2_BUCKET_NAME", "")
        if s3 and bucket:
            try:
                s3.delete_object(Bucket=bucket, Key=filename)
            except Exception:
                pass

    c.execute("DELETE FROM messages WHERE id = ? AND sender = ?", (msg_id, sender))
    affected = c.rowcount
    conn.commit()
    conn.close()

    if affected > 0:
        backup_db_to_b2()
        emit("message_deleted", {"id": msg_id}, room=PRIVATE_ROOM)

@socketio.on("typing")
def handle_typing(data):
    sender = connected_users.get(request.sid)
    if sender:
        emit("user_typing", {
            "user": sender,
            "isTyping": data.get("isTyping", False)
        }, room=PRIVATE_ROOM, include_self=False)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, host="0.0.0.0", port=port, debug=False, allow_unsafe_werkzeug=True)