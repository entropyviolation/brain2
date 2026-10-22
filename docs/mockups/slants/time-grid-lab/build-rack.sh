#!/bin/sh
# Builds the standalone Day Tubes page from the shared engine and board 1D.
cd "$(dirname "$0")" && cat src/00-head.html src/rack-body.html src/02-engine.js src/10-boards-d0.js src/24-sim.js src/24b-sandca.js src/25-boards-d1b.js src/26-tubeview.js src/rack-main.js > sample-rack.html && sed -i.bak "s/<title>Time Grid Studio/<title>Day Tubes/" sample-rack.html && rm -f sample-rack.html.bak
