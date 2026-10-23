"""Where the private data lives (data/, out/, .venv). Code may live elsewhere, e.g. the brain2 repo.

Every script accepts --home DIR (default ~/texts-analysis, or $TEXTS_HOME).
"""
import os
import sys
from pathlib import Path


def _take(flag):
    if flag in sys.argv:
        i = sys.argv.index(flag)
        val = sys.argv[i + 1] if i + 1 < len(sys.argv) else None
        del sys.argv[i:i + 2]
        return val
    return None


_h = _take("--home")
if _h:
    os.environ["TEXTS_HOME"] = str(Path(_h).expanduser())
HOME = Path(os.environ.get("TEXTS_HOME", "~/texts-analysis")).expanduser()
CODE = Path(__file__).resolve().parent
