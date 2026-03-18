#!/usr/bin/env bash
# OneSell Scout — One-Click Start
cd "$(dirname "$0")/.."
pnpm install --frozen-lockfile
cd onesell-client
pnpm dev
