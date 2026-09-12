#!/usr/bin/env bash
# Sets the password for the Client page gate.
#
# Prompts for a password (input is hidden), stores only its SHA-256 hash in
# client/index.html, and never writes the password itself anywhere.
#
#   bash tools/set-client-password.sh
#
# Reminder: this gate is a deterrent, not security. It runs in the visitor's
# browser and the client area is a public URL, so anyone determined can reach
# it regardless. Pixieset's own per-gallery password is the real protection.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PAGE="$ROOT/client/index.html"

[ -f "$PAGE" ] || { echo "error: cannot find $PAGE" >&2; exit 1; }

sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    printf '%s' "$1" | sha256sum | cut -d' ' -f1
  elif command -v node >/dev/null 2>&1; then
    node -e 'process.stdout.write(require("crypto").createHash("sha256").update(process.argv[1]).digest("hex"))' "$1"
  else
    echo "error: need sha256sum or node to hash the password" >&2
    exit 1
  fi
}

printf 'New client-area password: '
read -rs pw1; echo
printf 'Confirm password:         '
read -rs pw2; echo

[ -n "$pw1" ]        || { echo "error: password cannot be empty" >&2; exit 1; }
[ "$pw1" = "$pw2" ]  || { echo "error: passwords do not match" >&2; exit 1; }

if [ ${#pw1} -lt 8 ]; then
  echo "warning: short passwords are easy to guess offline from the stored hash." >&2
  echo "         Eight characters or more is strongly advised." >&2
fi

hash="$(sha256 "$pw1")"
unset pw1 pw2

# Replace the data-hash value, whatever it currently is.
perl -pi -e 's/(data-hash=")[0-9a-f]{64}(")/${1}'"$hash"'${2}/' "$PAGE"

if grep -q "data-hash=\"$hash\"" "$PAGE"; then
  echo "Password updated."
  echo
  echo "Next:"
  echo "  git add client/index.html"
  echo "  git commit -m 'Update client area password'"
  echo "  git push"
else
  echo "error: failed to write the new hash into $PAGE" >&2
  exit 1
fi
