#!/bin/sh
# Joins src/ into one page: head, body, then the scripts in order.
cd "$(dirname "$0")" && cat src/00-head.html src/01-body.html src/02-engine.js src/10-boards-d0.js src/20-boards-d1.js src/24-sim.js src/24b-sandca.js src/25-boards-d1b.js src/26-tubeview.js src/30-boards-d2.js src/40-boards-d3.js src/50-boards-d4.js src/90-main.js > time-grid-lab.html
