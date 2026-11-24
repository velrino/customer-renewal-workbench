#!/bin/sh
set -eu

CDPATH='' cd "$(dirname "$0")/../frontend/web"
pnpm install --frozen-lockfile
exec pnpm dev --hostname 127.0.0.1 --port 3000
