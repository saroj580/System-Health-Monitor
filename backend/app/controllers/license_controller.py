"""
controllers/license_controller.py
Handles all cryptographic license verification logic and in-app trial lifecycle.

Architecture:
- Model 1 (Full License): RSA PUBLIC KEY verifies JWT tokens signed by developer's private key.
- Model 2 (Trial Mode): In-app 7-day free trial stored with device-level trial_used tracking.
- Verification is 100% offline — mathematical proof, no remote server call needed.
"""

import logging
import sqlite3
from datetime import datetime, timezone, timedelta

import jwt
from jwt.exceptions import (
    ExpiredSignatureError,
    InvalidSignatureError,
    DecodeError,
)

logger = logging.getLogger(__name__)

ALGORITHM = "RS256"
TRIAL_DAYS = 7

#  Embedded RSA Public Key
# Generated once with generate_license.py's companion key-gen step.
# NEVER replace this with the private key. It can only *verify*, not forge.

PUBLIC_KEY = """-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqLjEMFXRiHPA5PgGI+IV
TkawSUC4WNTfUXDsGg5/mOTuOaq2vKPfthmQmhSDHpHpqMcVYolCqtrfDy6LDrJn
ug6F7BDUzDrgXsHLxYBYtMyQV8e+1r5t+rBrqdBHoz7r8dBugOtm6QbfMJ5+mFfI
XSnbtZNVo3TekSuFX28MkXt3Ko1f3e2flnLNGb8POkRzFrZui0ZoA4w3Vo8pkk1Y
XKPAYGMt+qxLMKHAEkr93Bbwb6VoXhvHeXd/gNL8imWZZH8vp1FNlP8O6191V/NX
f9OSG59Y3prNVqchAseuZ3cTSllIgRa0ehVIu3Vfx5dGpr/ZU6nN1+plxR2XfdtL
mQIDAQAB
-----END PUBLIC KEY-----"""


#  Verification 

class LicenseError(Exception):
    """Raised when a token or trial fails verification."""
    pass


def verify_token(token: str) -> dict:
    """
    Cryptographically verify a JWT license token using the embedded public key.
    Returns the decoded payload dict on success.
    Raises LicenseError with a human-readable message on failure.
    """
    try:
        payload = jwt.decode(
            token,
            PUBLIC_KEY,
            algorithms=[ALGORITHM],
            options={"require": ["exp", "iat", "sub"]},
        )
        return payload
    except ExpiredSignatureError:
        raise LicenseError("License key has expired.")
    except InvalidSignatureError:
        raise LicenseError("License key signature is invalid.")
    except DecodeError as exc:
        raise LicenseError(f"License key is malformed: {exc}")
    except Exception as exc:
        raise LicenseError(f"License verification failed: {exc}")


#  DB Helpers & Trial Engine 

def save_license(conn: sqlite3.Connection, token: str, payload: dict) -> None:
    """
    Upsert the license record for Model 1 (paid / developer-signed license key).
    Marks is_trial = 0, and records trial_used = 1.
    """
    exp_dt = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
    conn.execute(
        """
        INSERT INTO license (id, token, licensee_name, licensee_email, expires_at, is_trial, trial_used)
        VALUES (1, ?, ?, ?, ?, 0, 1)
        ON CONFLICT(id) DO UPDATE SET
            token          = excluded.token,
            licensee_name  = excluded.licensee_name,
            licensee_email = excluded.licensee_email,
            expires_at     = excluded.expires_at,
            is_trial       = 0,
            trial_used     = 1,
            activated_at   = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        """,
        (
            token,
            payload.get("name", ""),
            payload.get("sub", ""),
            exp_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
        ),
    )


def start_trial(conn: sqlite3.Connection, name: str, email: str) -> dict:
    """
    Model 2: Start an in-app 7-day free trial on this machine.
    Enforces device-level trial prevention if trial_used is already 1.
    """
    row = load_license(conn)
    if row and row.get("trial_used") == 1 and not row.get("is_trial"):
        # Already has full license or used trial
        pass

    if row and row.get("trial_used") == 1:
        # Check if already used
        raise LicenseError("The free trial has already been used on this device. Please activate with a license key.")

    now = datetime.now(tz=timezone.utc)
    exp_dt = now + timedelta(days=TRIAL_DAYS)
    trial_token = f"trial:{email}:{int(exp_dt.timestamp())}"

    conn.execute(
        """
        INSERT INTO license (id, token, licensee_name, licensee_email, expires_at, is_trial, trial_used)
        VALUES (1, ?, ?, ?, ?, 1, 1)
        ON CONFLICT(id) DO UPDATE SET
            token          = excluded.token,
            licensee_name  = excluded.licensee_name,
            licensee_email = excluded.licensee_email,
            expires_at     = excluded.expires_at,
            is_trial       = 1,
            trial_used     = 1,
            activated_at   = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        """,
        (
            trial_token,
            name.strip() or "Trial User",
            email.strip(),
            exp_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
        ),
    )
    return load_license(conn)  # type: ignore[return-value]


def load_license(conn: sqlite3.Connection) -> dict | None:
    """Return the stored license row as a dict, or None if not found."""
    row = conn.execute(
        """
        SELECT token, licensee_name, licensee_email, expires_at,
               is_trial, trial_used, activated_at
        FROM license
        WHERE id = 1
        """
    ).fetchone()
    return dict(row) if row else None


def is_trial_available(conn: sqlite3.Connection) -> bool:
    """Returns True if this installation has not used the free trial yet."""
    row = load_license(conn)
    if not row:
        return True
    return bool(row.get("trial_used", 0) == 0)


def is_license_valid(conn: sqlite3.Connection) -> tuple[bool, str]:
    """
    Check whether a stored license (Model 1 or Model 2) is active and valid.
    Returns (True, "") or (False, reason_string).
    """
    row = load_license(conn)
    if row is None:
        return False, "No license or trial found. Please start a trial or activate your copy."

    is_trial = bool(row.get("is_trial", 0))

    # Model 2: In-app Trial
    if is_trial:
        try:
            expires_at_str = row.get("expires_at", "")
            exp_dt = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
            now = datetime.now(tz=timezone.utc)
            if now > exp_dt:
                return False, "Your 7-day free trial has expired. Please enter a license key to continue."
            return True, ""
        except Exception as exc:
            return False, f"Trial verification error: {exc}"

    # Model 1: Asymmetric RSA Key Verification
    try:
        verify_token(row["token"])
        return True, ""
    except LicenseError as exc:
        return False, str(exc)


def calculate_days_left(expires_at_str: str | None) -> int | None:
    """Calculate whole days remaining until expiration."""
    if not expires_at_str:
        return None
    try:
        exp_dt = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
        now = datetime.now(tz=timezone.utc)
        diff = exp_dt - now
        return max(0, diff.days + (1 if diff.seconds > 0 else 0))
    except Exception:
        return None
