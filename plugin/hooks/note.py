#!/usr/bin/env python3
"""Adds a section to a small report beside the task, so a failed step can say why."""
import json
import os
import sys

folder = os.path.join(sys.argv[1] or os.getcwd(), '.usage-desk-cowork')
os.makedirs(folder, exist_ok=True)
path = os.path.join(folder, 'status.json')
try:
    with open(path) as f:
        status = json.load(f)
except (OSError, ValueError):
    status = {}
status[sys.argv[2]] = json.loads(sys.argv[3])
with open(path, 'w') as f:
    json.dump(status, f)
