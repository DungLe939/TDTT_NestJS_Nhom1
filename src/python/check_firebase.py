import firebase_admin
from firebase_admin import credentials, firestore
import sys

if sys.stdout.encoding != 'utf-8':
    try: sys.stdout.reconfigure(encoding='utf-8')
    except: pass

def get_env_var(key):
    try:
        with open("../../.env", "r", encoding="utf-8") as f:
            for line in f:
                if line.startswith(f"{key}="):
                    return line.strip().split("=", 1)[1].strip('"')
    except: return None
    return None

FIREBASE_CONFIG = {
    "type": "service_account",
    "project_id": get_env_var("FIREBASE_PROJECT_ID"),
    "private_key": get_env_var("FIREBASE_PRIVATE_KEY").replace("\\n", "\n") if get_env_var("FIREBASE_PRIVATE_KEY") else None,
    "client_email": get_env_var("FIREBASE_CLIENT_EMAIL"),
    "token_uri": "https://oauth2.googleapis.com/token",
}

if not firebase_admin._apps:
    cred = credentials.Certificate(FIREBASE_CONFIG)
    firebase_admin.initialize_app(cred)
db = firestore.client()

print("\n--- 5 MON MOI NHAT BAN VUA NAP TU SHOPEEFOOD ---")
docs = db.collection('rag_dictionary').order_by('updatedAt', direction=firestore.Query.DESCENDING).limit(5).stream()
for d in docs:
    data = d.to_dict()
    print(f"MOI NAP: {data['vi']}  ===>  {data['en']}")
print("----------------------------------------------\n")
