"""
Provision Cory Alimentos users for MG and RP tenants.
Uses Supabase Auth Admin API + PostgREST.
Password: Cory@2026
"""
import json
import ssl
import urllib.request
import urllib.error

# macOS Python SSL workaround
SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

SUPABASE_URL = "https://vaguswivhqnlbgqvnjch.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhZ3Vzd2l2aHFubGJncXZuamNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQ5NjQ1NCwiZXhwIjoyMDg2MDcyNDU0fQ.Ernn_NN3kiQXbCfX1536oKyaYMJS03tRxAWeTialJOI"

TENANT_MG = "3dcebbe4-833c-465b-a071-8152140ce001"
TENANT_RP = "c7d899f8-0e81-4059-b609-c6b77f6f0826"

PASSWORD = "Cory@2026"

HEADERS = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
}

# ── Users per tenant ──
users_mg = [
    {"full_name": "Venilton", "email": "vamaral@cory.com.br"},
    {"full_name": "Oderso", "email": "oderso.junior@cory.com.br"},
    {"full_name": "Genival", "email": "genival.andreasse@cory.com.br"},
    {"full_name": "José Grazina", "email": "jose.grazina@cory.com.br"},
    {"full_name": "Paulinho", "email": "manutencaoarc@cory.com.br"},
    {"full_name": "Marcela", "email": "marcela.ferreira@cory.com.br"},
    {"full_name": "Caio Pinheiro", "email": "caio.pinheiro@cory.com.br"},
    {"full_name": "João Marcos", "email": "joao.fileni@cory.com.br"},
    {"full_name": "Vinicius", "email": "vinicius.catozzo@cory.com.br"},
    {"full_name": "Valdeci", "email": "valdeci.junior@cory.com.br"},
    {"full_name": "Alex", "email": "alex.alves@cory.com.br"},
    {"full_name": "Mateus", "email": "matheus.adao@cory.com.br"},
    {"full_name": "Isabela", "email": "engenhariadeprocessos@cory.com.br"},
    {"full_name": "Andressa", "email": "andressa.neves@cory.com.br"},
    {"full_name": "Eloísa", "email": "eloisa.soares@cory.com.br"},
    {"full_name": "Luís", "email": "luis.barbosa@cory.com.br"},
    {"full_name": "Rinaldo", "email": "rinaldo.capitelli@cory.com.br"},
]

users_rp = [
    {"full_name": "Oziel", "email": "oziel.silva@cory.com.br"},
    {"full_name": "Gustavo Marcili", "email": "gustavo.marcili@cory.com.br"},
    {"full_name": "Luana", "email": "luana.moschegni@cory.com.br"},
    {"full_name": "Ed", "email": "edwilliam2008@hotmail.com"},
    {"full_name": "Fabiana", "email": "fabianamartinss433@gmail.com"},
    {"full_name": "Samuel", "email": "sambelmont91@gmail.com"},
    {"full_name": "Vinicius", "email": "viniciuscesar0816@gmail.com"},
    {"full_name": "Helon Ferreira", "email": "helon.ferreira@cory.com.br"},
    {"full_name": "Angelo", "email": "angelo.araujo@cory.com.br"},
    {"full_name": "Ana Beatriz", "email": "ana.maringolo@cory.com.br"},
    {"full_name": "Gabriel Marcari", "email": "gabriel.marcari@cory.com.br"},
    {"full_name": "Erica", "email": "erica.souza@cory.com.br"},
    {"full_name": "Artur", "email": "artur.barcelos@cory.com.br"},
    {"full_name": "Mateus Faria", "email": "mateus.faria@cory.com.br"},
    {"full_name": "Priscila", "email": "priscila.ferreira@cory.com.br"},
    {"full_name": "Alex", "email": "segurancadotrabalhorp@cory.com.br"},
    {"full_name": "Laura", "email": "laura.chiaretti@cory.com.br"},
]

# Caio Pinheiro is in MG list; skip duplicate in RP
CAIO_EMAIL = "caio.pinheiro@cory.com.br"


def api_request(url, data=None, method="POST"):
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req, context=SSL_CTX) as resp:
            return json.loads(resp.read().decode()), resp.status
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        try:
            return json.loads(err_body), e.code
        except:
            return {"message": err_body}, e.code


def create_auth_user(email, full_name):
    """Create auth user, return user ID or None."""
    url = f"{SUPABASE_URL}/auth/v1/admin/users"
    payload = {
        "email": email,
        "password": PASSWORD,
        "email_confirm": True,
        "user_metadata": {"full_name": full_name},
    }
    data, status = api_request(url, payload)

    if status == 200 or status == 201:
        uid = data.get("id")
        print(f"  ✓ Auth created: {uid}")
        return uid

    msg = data.get("message", data.get("msg", str(data)))
    if "already been registered" in str(msg):
        # Fetch existing user by email
        list_url = f"{SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000"
        req = urllib.request.Request(list_url, headers=HEADERS)
        with urllib.request.urlopen(req, context=SSL_CTX) as resp:
            all_users = json.loads(resp.read().decode())
        users_list = all_users.get("users", all_users) if isinstance(all_users, dict) else all_users
        for u in users_list:
            if u.get("email") == email:
                uid = u["id"]
                print(f"  ↺ Already exists: {uid}")
                return uid
        print(f"  ✗ Exists but not found in list")
        return None

    print(f"  ✗ Auth error ({status}): {msg}")
    return None


def create_app_user(uid, tenant_id, email, full_name, role="student"):
    """Create application user profile."""
    url = f"{SUPABASE_URL}/rest/v1/users"
    headers = {**HEADERS, "Prefer": "return=representation,resolution=merge-duplicates"}
    payload = {
        "id": uid,
        "tenant_id": tenant_id,
        "email": email,
        "full_name": full_name,
        "role": role,
    }
    body = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, context=SSL_CTX) as resp:
            print(f"  ✓ Profile created ({role})")
            return True
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print(f"  ✗ Profile error ({e.code}): {err}")
        return False


def provision_users(users, tenant_id, tenant_name):
    print(f"\n{'='*60}")
    print(f"  TENANT: {tenant_name}")
    print(f"{'='*60}")
    created = 0
    failed = 0
    skipped = 0

    for u in users:
        email = u["email"]
        name = u["full_name"]

        # Skip Caio Pinheiro in RP (already in MG)
        if tenant_name == "Cory Alimentos-RP" and email == CAIO_EMAIL:
            print(f"\n[SKIP] {name} ({email}) — already provisioned in MG")
            skipped += 1
            continue

        print(f"\n[{email}] {name}")
        uid = create_auth_user(email, name)
        if not uid:
            failed += 1
            continue

        if create_app_user(uid, tenant_id, email, name):
            created += 1
        else:
            failed += 1

    print(f"\n--- {tenant_name}: {created} created, {failed} failed, {skipped} skipped ---")
    return created, failed, skipped


if __name__ == "__main__":
    print("Provisioning Cory Alimentos users...")
    print(f"Password: {PASSWORD}")

    mg_c, mg_f, mg_s = provision_users(users_mg, TENANT_MG, "Cory Alimentos - MG")
    rp_c, rp_f, rp_s = provision_users(users_rp, TENANT_RP, "Cory Alimentos-RP")

    total_c = mg_c + rp_c
    total_f = mg_f + rp_f

    print(f"\n{'='*60}")
    print(f"  SUMMARY")
    print(f"{'='*60}")
    print(f"  MG: {mg_c} created, {mg_f} failed")
    print(f"  RP: {rp_c} created, {rp_f} failed, {rp_s} skipped")
    print(f"  TOTAL: {total_c} created, {total_f} failed")
    print(f"\n  ⚠ Caio Pinheiro: provisioned in MG only (same email)")
    print(f"\nDone.")
