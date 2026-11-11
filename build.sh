#!/bin/sh
# Builds the panel page and packs the two files people install, into dist/.
set -e
cd "$(dirname "$0")"
version=$(python3 -c "import json; print(json.load(open('plugin/.claude-plugin/plugin.json'))['version'])")
python3 panel/build.py
mkdir -p plugin/panel dist
cp panel/panel.html plugin/panel/usage-desk.html
rm -f dist/*.mcpb dist/*.zip
(cd extension && zip -qr "../dist/usage-desk-$version.mcpb" . -x '.DS_Store' -x '*/.DS_Store' -x '*__pycache__*')
(cd plugin && zip -qr "../dist/usage-desk-cowork-$version.zip" . -x 'hooks/register.test.tsx' -x '.DS_Store' -x '*/.DS_Store')
ls dist
