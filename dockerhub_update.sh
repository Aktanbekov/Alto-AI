#!/bin/bash
set -e
cd ~/apps/altoai
docker compose pull
docker compose up -d --force-recreate
