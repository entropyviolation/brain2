#!/bin/sh
# Builds the Day Tubes popup page for the app: shared engine, board 1D, live-data bridge. Output is served at /day-tubes/index.html.
cd "$(dirname "$0")" && mkdir -p ../../../../public/day-tubes && cat src/00-head.html src/app-body.html src/02-engine.js src/10-boards-d0.js src/24-sim.js src/24b-sandca.js src/25-boards-d1b.js src/26-tubeview.js src/rack-main.js src/app-bridge.js > ../../../../public/day-tubes/index.html && sed -i.bak "s/<title>Time Grid Studio/<title>Day Tubes/" ../../../../public/day-tubes/index.html && rm -f ../../../../public/day-tubes/index.html.bak
