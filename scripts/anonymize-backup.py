#!/usr/bin/env python3
"""
Scrub a real Brain2 full backup into a safe Demo-profile backup.

  python3 -I scripts/anonymize-backup.py <real-backup.json> <out.json> [--seed N]

Keeps: JSON shape, ids, enums (any string that appears as a literal in the app
source), numbers, dates, counts, nesting, links between rows.
Replaces: every other string (titles, notes, names, places, URLs, HTML bodies,
JSON-in-strings), coordinates, birthdays, and every attachment image/file.
The same original string always becomes the same invented string, so a list
name, a reference to it and a tag keep matching.
Output is stamped `dataProfile: "demo"` so it can only restore onto Demo.
"""
import base64, hashlib, io, json, os, random, re, struct, sys, zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

FIRST = """Ada Bea Cal Dev Eli Fay Gus Hal Ivy Jem Kit Lou Mae Ned Oli Pia Quin Rae Sam Tess Uma Vic Wren Xan Yael Zed
Arlo Briar Cleo Dani Ezra Faye Gwen Hugo Iris Jude Kai Luca Mira Nico Odie Pru Remy Sage Tove Una Vera Wyatt Yara Zoe
Anders Beatrix Callum Delphine Elio Freya Gideon Hattie Idris Juno Kestrel Lenny Marlo Nell Orla Perry Quill Rosa Silas Thea""".split()
LAST = """Alder Birch Cobb Dunmore Ellery Fenn Garrow Hale Ivers Jory Keane Lund Marsh Noble Oakes Pike Quarry Rudd Sloan Thorne
Upton Vane Wick Yardley Zeller Ashby Brook Crane Doyle Eames Flint Gray Holt Irving Judd Kerr Lowe Mercer Nash""".split()
WORDS = """apple river lamp garden window paper copper fabric morning basket orbit ladder pocket marble ribbon canvas harbor
meadow anchor button candle drawer engine feather gravel hammer island jacket kettle lantern mirror needle orchard pebble quilt
rocket saddle ticket umbrella velvet walnut yarn zipper bridge compass dial echo forest glass hollow ink jar knot lake maple
nest oven plank quartz radio shelf thread union valley wagon yard zone bench cable dune ember flute grove hinge jungle kiln
ledger moss notch olive plume quiver rope spool tile urn vessel wheel yoke arch beam clay dust elm fern glow hill iron jade
loop mint nook opal pine reed sand tide vine wool atlas brick cloud drift field grain haze inlet jewel knack latch mound
check call plan fix send read write book visit order pay clean sort review update draft fold wash pack move tidy renew test
sketch print label stack mend polish return gather arrange borrow collect deliver fetch inspect measure notify prepare
quiet bright small tall early late slow steady fresh warm cool plain round narrow gentle brisk calm mild sharp""".split()
ADJ = "quiet bright small tall early late slow steady fresh warm cool plain round narrow gentle brisk calm mild sharp".split()
CITIES = ["Marlow Bay", "Cedar Falls", "Port Alder", "Linden", "Westmere", "Foxhollow", "Brightwater", "Northgate"]


# App catalog / seed words that name a real work, place or habit of the owner.
DENY = {"Aftersun", "Amélie", "Anomalisa", "Dune", "Frances Ha", "Stalker", "Galveston", "San Diego", "san diego",
        "Ariel", "Primer", "Gravity", "Finish CDs", "Read a lot", "Swim more", "Create art", "Be healthy", "Be happy",
        "Chungking Express", "Look good", "Do dishes", "Wipe sink", "Wipe stove", "Tidy floor", "Home Notes", "Elijah", "Ocean Beach", "Aeroméxico", "LATAM Airlines", "LATAM", "AEROMEXICO", "Aeromexico"}


def seed_hash(s, salt):
    return int(hashlib.sha256((salt + "\x00" + s).encode()).hexdigest()[:16], 16)


def source_literals():
    """Every quoted string in app source: enum values, system names, catalog labels."""
    lits = set()
    idents = set()
    pat = re.compile(r"""(?:"((?:[^"\\\n]|\\.){1,80})"|'((?:[^'\\\n]|\\.){1,80})'|`([^`$\\\n]{1,80})`)""")
    skip = {"node_modules", ".next", "out", "docs", "test-results", "data", "ios", "designrefs", "litrefs"}
    for top in ("lib", "components", "app", "hooks"):
        for dp, dn, fs in os.walk(os.path.join(ROOT, top)):
            dn[:] = [d for d in dn if d not in skip]
            for f in fs:
                if not f.endswith((".ts", ".tsx", ".mjs", ".js", ".json")):
                    continue
                if ".test." in f or f.startswith("demo-") or "demo-corpus" in dp or "seed" in f:
                    continue  # tests and demo seeds hold sample prose, not enums
                dataish = any(x in f.lower() for x in ("quotes", "filmrecs", "templates", "bank", "vocab", "affirm", "glossary", "catalog"))
                if "vocab" in dp or "data" in dp.split(os.sep):
                    dataish = True
                try:
                    txt = open(os.path.join(dp, f), encoding="utf8", errors="ignore").read()
                except OSError:
                    continue
                if len(txt) > 400_000:
                    continue
                idents.update(re.findall(r"\b[A-Za-z_$][A-Za-z0-9_$]{2,40}\b", txt)) if not dataish else None
                txt = re.sub(r"/\*.*?\*/", "", txt, flags=re.S)
                txt = re.sub(r"(?m)^\s*//.*$|(?<=\s)//\s.*$", "", txt)
                for m in pat.finditer(txt):
                    s = m.group(1) or m.group(2) or m.group(3)
                    if s and not dataish:
                        lits.add(s)
    lits -= DENY
    lits = {x for x in lits if "San Diego" not in x and "california" not in x.lower()}
    return lits, idents


ISO = re.compile(r"^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$")
TIME = re.compile(r"^\d{1,2}:\d{2}(:\d{2})?\s?([ap]m)?$", re.I)
NUMLIKE = re.compile(r"^[\s\d.,:%+\-/*x×$€£]+$")
COLOR = re.compile(r"^(#[0-9a-fA-F]{3,8}|(rgb|hsl|oklch|color-mix)a?\(.*\)|var\(--[\w-]+\))$")
URL = re.compile(r"^(https?://|www\.)\S+$", re.I)
EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PHONE = re.compile(r"(?<!\d)(\+?\d[\d\s().-]{7,}\d)(?!\d)")
IDLIKE = re.compile(r"^[A-Za-z][A-Za-z0-9]*([-_:.][A-Za-z0-9]+)*$")
HASDIGIT = re.compile(r"\d")
LATLNG_KEY = re.compile(r"^(lat|lng|lon|long|latitude|longitude)$", re.I)
BIRTH_KEY = re.compile(r"birth|born|dob|datemet|anniversary", re.I)
NAMEY_KEY = re.compile(r"fullname|firstname|lastname|nick|person|author|contact|friend|who$|owner|assignee|attendee|sender|recipient|username", re.I)
PERIOD_WORDS = re.compile(r"(?i)\b(day|week|month|quarter|season|year|dayPlan|weekPlan|monthPlan|quarterPlan|[qw]\d+|t|z)\b|(?<=\d)[TZqQwW](?=\d)|[TZ]$")
URL_ANY = re.compile(r"(?:https?://|www\.)[^\s\"'<>)\]]+", re.I)
COORD = re.compile(r"(-?\d{1,3}\.\d{2,})(\s*,\s*|\s+)(-?\d{1,3}\.\d{2,})")
PLACEY_KEY = re.compile(r"city|town|place|address|location|venue|street|country|state|region", re.I)


class Scrubber:
    def __init__(self, seed):
        self.salt = f"brain2-demo-{seed}"
        self.lits, self.idents = source_literals()
        self.cache = {}
        self.json_cache = {}
        self.attachments_seen = 0
        r = random.Random(seed)
        self.dlat = r.uniform(-9, 9)
        self.dlng = r.uniform(-30, 30)
        self.base_lat, self.base_lng = 44.5, -69.8  # an invented-feeling home; shifts below
        self.lat0 = self.lng0 = None
        self.stats = {"kept_lit": 0, "replaced": 0}

    # ---- text generators -------------------------------------------------
    def rng(self, s):
        return random.Random(seed_hash(s, self.salt))

    def fake_name(self, r, words=2):
        out = [r.choice(FIRST)]
        if words >= 2:
            out.append(r.choice(LAST))
        for _ in range(max(0, words - 2)):
            out.append(r.choice(WORDS).capitalize())
        return " ".join(out[:words] if words >= 1 else out)

    def case_like(self, src, text):
        letters = [c for c in src if c.isalpha()]
        if not letters:
            return text
        if all(c.isupper() for c in letters) and len(letters) > 1:
            return text.upper()
        if all(c.islower() for c in letters):
            return text.lower()
        words = src.split()
        if len(words) > 1 and sum(w[:1].isupper() for w in words if w[:1].isalpha()) >= max(2, len(words) // 2 + 0):
            return " ".join(w.capitalize() for w in text.split())
        return text[:1].upper() + text[1:]

    def fake_digits(self, r, m):
        s = m.group(0)
        return "".join(str(r.randint(0, 9)) if c.isdigit() else c for c in s)

    def fake_phrase(self, s, key=None):
        r = self.rng(s)
        toks = re.findall(r"[^\s]+", s)
        n = max(1, min(len(toks), 400))
        namey = key and NAMEY_KEY.search(key) and n <= 3
        placey = key and PLACEY_KEY.search(key) and n <= 3
        if namey:
            body = self.fake_name(r, n)
        elif placey:
            body = r.choice(CITIES) if n <= 2 else f"{r.randint(10, 999)} {r.choice(WORDS).capitalize()} Street"
        else:
            w = [r.choice(WORDS) for _ in range(n)]
            if n >= 3 and r.random() < 0.5:
                w[0] = r.choice(ADJ)
            body = " ".join(w)
        body = self.case_like(s, body)
        # keep sentence punctuation shape
        lead = re.match(r"^[^\w\d]*", s).group(0)
        trail = re.search(r"[^\w\d]*$", s).group(0)
        if lead and not body.startswith(lead):
            body = lead + body
        if trail and not body.endswith(trail):
            body = body + trail
        return body

    def fake_slug(self, s):
        r = self.rng(s)
        parts = re.split(r"([-_:.])", s)
        out = []
        for p in parts:
            if p in "-_:.":
                out.append(p)
            elif HASDIGIT.search(p) and len(p) >= 6:
                out.append(p)  # opaque id fragment
            elif p.isdigit():
                out.append(p)
            else:
                out.append(r.choice(WORDS))
        return "".join(out)

    # ---- string classification ------------------------------------------
    def scrub_str(self, s, key=None):
        if s == "" or s.strip() == "":
            return s
        t = s.strip()
        if (t.startswith("{") and t.endswith("}")) or (t.startswith("[") and t.endswith("]")):
            try:
                obj = json.loads(s)
            except ValueError:
                obj = None
            if obj is not None:
                seps = (",", ":") if ", " not in s[:200] and ": " not in s[:200] else (", ", ": ")
                return json.dumps(self.scrub(obj, key), ensure_ascii=False, separators=seps)
        if len(s) > 160 and not (URL_ANY.fullmatch(t) or ("\n" not in s and URL_ANY.search(s))):
            return self.scrub_longform(s, key)
        if s in self.cache:
            return self.cache[s]
        out = self._scrub_str(s, key)
        self.cache[s] = out
        return out

    def fake_url(self, u):
        host = self.fake_slug(u.split("//")[-1].split("/")[0].replace(".", "-"))
        return f"https://example.org/{host}/{self.rng(u).randint(100, 999)}"

    def _scrub_str(self, s, key):
        if "|" in s and re.match(r"^\d{4}-\d{2}-\d{2}\|", s):  # sun-times key
            return self.scrub_sun_key(s)
        if URL_ANY.search(s) and not s.startswith(("idb:", "link:", "data:")):
            parts = re.split(r"((?:https?://|www\.)[^\s\"'<>)\]]+)", s)
            return "".join(self.fake_url(x) if re.match(r"(https?://|www\.)", x) else (self.scrub_str(x, key) if x.strip() else x) for x in parts)
        if COORD.search(s):
            s = COORD.sub(lambda m: f"{self.geo(float(m.group(1)), 'lat'):.4f}{m.group(2)}{self.geo(float(m.group(3)), 'lng'):.4f}", s)
            if not any(c.isalpha() for c in s):
                return s
        if s in self.lits:
            self.stats["kept_lit"] += 1
            return s
        if key and re.search(r"chat|user|telegram|phone|account|message", key, re.I) and re.fullmatch(r"-?\d{6,}", s):
            return "".join(str(self.rng(s + str(i)).randint(0, 9)) if c.isdigit() else c for i, c in enumerate(s))
        if re.fullmatch(r"-?\d{9,}", s) and not re.fullmatch(r"1[5-9]\d{11}", s):
            return "".join(str(self.rng(s + str(i)).randint(0, 9)) if c.isdigit() else c for i, c in enumerate(s))
        if not re.search(r"[A-Za-z]", PERIOD_WORDS.sub("", s)) and re.search(r"\d{4}", s):
            return s
        if ISO.match(s) or TIME.match(s) or NUMLIKE.match(s) or COLOR.match(s):
            if key and BIRTH_KEY.search(key) and ISO.match(s):
                return self.shift_date(s)
            return s
        if s.startswith(("idb:", "link:", "data:")):
            return s
        if URL.match(s):
            return f"https://example.org/{self.fake_slug(s.split('//')[-1].split('/')[0].replace('.', '-'))}/{self.rng(s).randint(100, 999)}"
        if not any(c.isalpha() for c in s):
            return PHONE.sub(lambda m: self.fake_digits(self.rng(s), m), s)
        if "|" in s and re.match(r"^\d{4}-\d{2}-\d{2}\|", s):  # sun-times key
            return self.scrub_sun_key(s)
        if EMAIL.fullmatch(s):
            return f"{self.rng(s).choice(FIRST).lower()}@example.com"
        if " " not in s and "\n" not in s and IDLIKE.match(s):
            # an id / slug / token
            if HASDIGIT.search(s) and re.search(r"[0-9a-f]{6,}|\d{6,}", s) and not NAMEY_KEY.search(key or ""):
                return s  # opaque generated id
            return self.fake_slug(s) if re.search(r"[-_:.]", s) else self.fake_phrase(s, key)
        txt = EMAIL.sub(lambda m: f"{self.rng(m.group(0)).choice(FIRST).lower()}@example.com", s)
        if txt != s and not any(c.isalpha() for c in EMAIL.sub("", s)):
            return txt
        txt = self.fake_phrase(s, key)
        txt = re.sub(r"\d{3,}", lambda m: self.fake_digits(self.rng(s), m), txt)
        self.stats["replaced"] += 1
        return txt

    def scrub_longform(self, s, key):
        if s in self.cache:
            return self.cache[s]
        if re.search(r"</?(p|div|span|h[1-6]|ul|ol|li|br|a|b|i|u|strong|em|table|tr|td|blockquote|pre|code|img|hr)\b[^>]*>", s, re.I):
            # HTML: keep the tags, replace every piece of text between them
            def rep(txt):
                if not any(c.isalpha() for c in txt):
                    return txt
                lead = txt[: len(txt) - len(txt.lstrip())]
                trail = txt[len(txt.rstrip()):]
                return lead + self.scrub_line(txt.strip()) + trail
            parts = re.split(r"(<[^>]*>)", s)
            out = "".join(p if p.startswith("<") and p.endswith(">") and re.match(r"</?[A-Za-z!]", p) else rep(p) for p in parts)
            out = re.sub(r"\b(alt|title)=\"[^\"]*\"", r'\1="x"', out)
            out = re.sub(r"(href|src)=\"[^\"]*\"", lambda m: f'{m.group(1)}="https://example.org/x"', out)
        else:
            lines = []
            for ln in s.split("\n"):
                m = re.match(r"^(\s*(?:#{1,6}\s+|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+|>\s+|\[[ xX]\]\s+|\d{1,2}:\d{2}\s+)?)(.*)$", ln)
                head, rest = m.group(1), m.group(2)
                lines.append(head + (self.scrub_line(rest) if rest.strip() else rest))
            out = "\n".join(lines)
        self.cache[s] = out
        return out

    def scrub_line(self, text):
        """One markdown line; long prose is cut at sentence ends so nothing recurses."""
        if len(text) <= 160:
            return self.scrub_str(text, None)
        bits = re.split(r"(?<=[.!?;])\s+", text)
        if len(bits) == 1:
            bits = [text[i:i + 120] for i in range(0, len(text), 120)]
        return " ".join(self.scrub_str(b, None) if len(b) <= 160 else self.fake_phrase(b) for b in bits)

    # ---- geo + dates -----------------------------------------------------
    def geo(self, v, key):
        is_lat = key.lower().startswith("lat")
        if not isinstance(v, (int, float)) or isinstance(v, bool):
            return v
        if is_lat and self.lat0 is None:  # the first point seen lands on an invented home
            self.lat0 = float(v); self.dlat = 41.6 - self.lat0
        if not is_lat and self.lng0 is None:
            self.lng0 = float(v); self.dlng = -93.6 - self.lng0
        shifted = float(v) + (self.dlat if is_lat else self.dlng)
        shifted = max(-80, min(80, shifted)) if is_lat else ((shifted + 180) % 360) - 180
        return round(shifted, 4)

    def shift_date(self, s):
        days = (seed_hash(s, self.salt) % 400) - 200
        from datetime import date, timedelta
        try:
            d = date.fromisoformat(s[:10]) + timedelta(days=days)
            return d.isoformat() + s[10:]
        except ValueError:
            return s

    def scrub_sun_key(self, s):
        parts = s.split("|")
        if len(parts) == 3:
            try:
                return f"{parts[0]}|{self.geo(float(parts[1]), 'lat')}|{self.geo(float(parts[2]), 'lng')}"
            except ValueError:
                pass
        return s

    def prepass_geo(self, src):
        """Put the median point of the owner's coordinates on an invented home."""
        lats, lngs = [], []
        def w(v, k=None):
            if isinstance(v, dict):
                for kk, x in v.items():
                    w(x, kk)
            elif isinstance(v, list):
                for x in v:
                    w(x, k)
            elif isinstance(v, str):
                t = v.strip()
                if t[:1] in "{[" and t[-1:] in "}]":
                    try:
                        w(json.loads(v), k)
                    except ValueError:
                        pass
            elif isinstance(v, (int, float)) and not isinstance(v, bool) and k and LATLNG_KEY.match(k):
                (lats if k.lower().startswith("lat") else lngs).append(float(v))
        w(src["stores"]); w(src.get("extras", {}))
        if lats and lngs:
            lats.sort(); lngs.sort()
            self.lat0, self.lng0 = lats[len(lats) // 2], lngs[len(lngs) // 2]
            self.dlat, self.dlng = 41.6 - self.lat0, -93.6 - self.lng0

    # ---- tree walk -------------------------------------------------------
    def scrub_key(self, k):
        if k in self.lits or k in self.idents or ISO.match(k) or NUMLIKE.match(k):
            return k
        if re.match(r"^(dayPlan|weekPlan|monthPlan|quarterPlan|brain2|cogs|gs|weekly)[-_.]", k) or k.startswith(("pack-", "task-", "list-", "m-")):
            return k
        return self.scrub_str(k, None)

    def scrub(self, v, key=None):
        if isinstance(v, dict):
            out = {}
            for k, x in v.items():
                nk = self.scrub_key(k)
                out[nk] = self.scrub(x, k)
            return out
        if isinstance(v, list):
            return [self.scrub(x, key) for x in v]
        if isinstance(v, str):
            if key and LATLNG_KEY.match(key):
                try:
                    return str(self.geo(float(v), key))
                except ValueError:
                    pass
            return self.scrub_str(v, key)
        if isinstance(v, (int, float)) and not isinstance(v, bool) and key and LATLNG_KEY.match(key):
            return self.geo(v, key)
        return v


# ---- attachments ---------------------------------------------------------
def png(w, h, rgb):
    def chunk(t, d):
        c = struct.pack(">I", len(d)) + t + d
        return c + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    row = b"\x00" + bytes(rgb) * w
    raw = row * h
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


def pdf(text):
    body = f"BT /F1 18 Tf 60 720 Td ({text}) Tj ET"
    objs = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        f"<< /Length {len(body)} >>\nstream\n{body}\nendstream",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out, offs = b"%PDF-1.4\n", []
    for i, o in enumerate(objs, 1):
        offs.append(len(out))
        out += f"{i} 0 obj\n{o}\nendobj\n".encode()
    xref = len(out)
    out += f"xref\n0 {len(objs)+1}\n0000000000 65535 f \n".encode()
    for o in offs:
        out += f"{o:010d} 00000 n \n".encode()
    out += f"trailer\n<< /Size {len(objs)+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode()
    return out


def fake_attachment(key, att, sc):
    r = sc.rng(key)
    mime = att.get("mime", "")
    rgb = (r.randint(110, 220), r.randint(110, 220), r.randint(110, 220))
    ext = {"image/png": "png", "image/webp": "png", "image/jpeg": "png", "application/pdf": "pdf"}.get(mime, "bin")
    name = sc.fake_phrase(os.path.splitext(att.get("name", "file"))[0].replace("_", " ").replace("-", " ")).replace(" ", "-").lower()
    if mime.startswith("image/"):
        data, mime = png(96, 96, rgb), "image/png"
        fname = f"{name}.png"
    elif mime == "application/pdf":
        data, fname = pdf("Sample document - demo data"), f"{name}.pdf"
    else:
        data, fname = b"Demo placeholder file.\n", f"{name}.txt"
        mime = "text/plain"
    return {"name": fname, "mime": mime, "dataUrl": f"data:{mime};base64," + base64.b64encode(data).decode()}


# ---- rich synthetic tracking-log data ---------------------------------------
from datetime import date as _date, timedelta as _td

SPEND = [("coffee", 450, "card"), ("lunch", 1385, "card"), ("bus pass", 6000, "account"), ("groceries", 5422, "card"),
         ("paperback", 1699, "card"), ("bakery", 780, "cash"), ("parking", 600, "cash"), ("tea", 520, "cash"),
         ("print shop", 1240, "account"), ("pharmacy", 1875, "card"), ("ferry fare", 925, "card"), ("plant pot", 2310, "card"),
         ("laundry", 400, "cash"), ("stationery", 1450, "card"), ("lunch special", 1190, "card"), ("seed packets", 899, "cash")]
INTAKE = {"food": ["oatmeal with pears", "toast and eggs", "lentil soup", "apple", "rice bowl", "yogurt", "pasta", "cheese plate"],
          "drink": ["coffee", "green tea", "water", "orange juice", "oat latte", "sparkling water"],
          "drug": ["ibuprofen", "vitamin d", "melatonin", "allergy pill", "magnesium"]}
EVENTS = ["left room", "went outside", "headache", "phone call", "fell asleep on couch", "watered plants", "doorbell",
          "power flicker", "heard birds", "ran out of tea", "took the stairs", "stretched"]
THOUGHTS = [("Opening the editor to fix the clock", "Then the dishes. Relieved it is a small fix, and a small fix is enough for today."),
            ("Why the plan keeps slipping at 3pm", "Energy dips after lunch, so heavy tasks belong before noon. Reasoning: move review to the morning, keep the afternoon for errands."),
            ("Deciding between two drafts", "Draft A is shorter, draft B explains the why. Analysis: readers skim, so lead with A and link B."),
            ("Noticing the loop", "The same worry again. Name it, write the next small step, close the laptop."),
            ("Summary of the walk", "Cold air, clear head, three ideas. Keep the second one."),
            ("What I would tell past me", "Start with the ugly version. It teaches the shape faster than planning does.")]
NOTES = [("Library errand", "Return two books, ask about the hold.\nCloses at 6."), ("Recipe tweak", "Less salt, more lemon.\nTry again Sunday."),
         ("Idea for the shelf", "Label the bins by season, not by type."), ("Reminder", "Bring the tote bag.")]
SWITCHES = [("reading", "email"), ("email", "walk"), ("writing", "dishes"), ("dishes", "reading"), ("planning", "writing")]
SUMMARY = ["Slow start, steady middle. Finished the draft and the errands; skipped the gym.",
           "Rainy day indoors. Cooked, tidied, read two chapters. Early night.",
           "Busy morning of calls, quiet afternoon. Walked at sunset.",
           "Good focus block before lunch. Lost an hour to small chores. Called a friend."]
WEEK_SUM = ["A balanced week: three long focus blocks, two walks, and a clean kitchen. Sleep ran late midweek.",
            "Travel prep took over. Plans slid, but the packing list is done and the key tasks are closed."]
REASON = [("went well", "Started early; kept the phone in another room."), ("improve", "Batch the errands instead of five small trips."),
          ("learned", "A ten-minute plan saves an hour of drifting.")]
MOODS = [("calm", "pleasant", "loose shoulders, slow breath", "settled"), ("restless", "unpleasant", "tight chest, quick pulse", "needs a task"),
         ("curious", "pleasant", "bright, forward lean", "wants to try things"), ("tired", "neutral", "heavy eyes", "ask for rest")]
INTENTS = [("event-log", "log: left room", "Logged event: left room", "applied"), ("event-log", "log: headache est", "Logged event: headache (estimated clock)", "applied"),
           ("thought-process", "tp: Deciding between two drafts", "Thought process saved", "applied"), ("intake", "intake food: toast and eggs", "Intake food: toast and eggs", "applied"),
           ("intake", "intake drink: green tea", "Intake drink: green tea", "applied"), ("switch", "switch: reading -> email", "Switched reading to email", "applied"),
           ("note", "note: bring the tote bag", "Note saved to the day summary", "applied"), ("track", "track reading 45m", "Painted reading 45 minutes", "applied"),
           ("habit", "habit stretch", "Checked off stretch", "applied"), ("mood", "mood calm", "Mood calm logged", "applied"),
           ("sleep", "slept 11pm woke 7am", "Sleep recorded 8h", "applied"), ("gps", "gps", "Location sample stored", "applied"),
           ("start", "start writing", "Started writing", "applied"), ("stop", "stop", "Stopped writing, 52m", "applied"),
           ("capture", "buy lemons", "Added to Inbox", "applied"), ("bulk", "- call the dentist\n- renew pass", "Added 2 items", "applied"),
           ("receipt", "photo of receipt", "Receipt read: $23.10", "clarify"), ("grocery", "grocery milk oats", "Grocery list updated", "applied"),
           ("needed", "needed batteries", "Added to Needed", "applied"), ("bought", "bought batteries", "Moved to Bought", "applied"),
           ("pin", "pin grocery", "Pinned grocery list", "applied"), ("today", "today", "Today: 4 tasks, 2 events", "applied"),
           ("morning", "morning", "Morning ritual started", "clarify"), ("night", "night", "Night ritual started", "applied"),
           ("plan", "plan: write the outline", "Plan line added", "applied"), ("plan-now", "plan now", "Plan for now sent", "applied"),
           ("search", "search lemons", "3 matches", "applied"), ("lists", "lists", "12 lists", "applied"), ("info", "info", "Status sent", "ignored"),
           ("help", "help", "Help sent", "applied"), ("count", "count joints +1", "Count updated", "applied"), ("cycle", "cycle spotting", "Cycle mark saved", "applied"),
           ("iphone-screen", "screen 38m browsing", "Screen time stamped", "applied"), ("iphone-call", "call 12m", "Call ping saved", "applied"),
           ("journal", "journal: a calm day", "Journal entry saved", "applied"), ("unknown", "asdf", "Not understood", "error"),
           ("link", "https://example.org/read/42", "Link saved", "applied"), ("menu", "menu", "Menu sent", "clarify"), ("pair", "pair 4821", "Pairing ignored", "ignored")]


def _d(s):
    return _date.fromisoformat(s)


def enrich(out, seed):
    """Add compact, invented rows for every tracking-log kind. Uses only ids already in the vault."""
    r = random.Random(seed * 7919)
    tg = out["stores"]["brain2-timegrid-store"]["state"]
    entries = tg["entries"]
    act = next(sc for sc in tg["scopes"] if sc["id"] == "activity")
    def ensure_pen(scope, pid, name, color):
        for p in scope["pens"]:
            if p["name"].lower() == name.lower():
                return p["id"]
        scope["pens"].append({"id": pid, "name": name, "color": color})
        return pid
    spent = ensure_pen(act, "act-spent", "Spent", "#16a34a")
    intake = ensure_pen(act, "act-intake", "Intake", "#f97316")
    textlog = ensure_pen(act, "act-text-log", "Text log", "#64748b")
    switch = ensure_pen(act, "act-switch", "Switch", "#0ea5e9")
    reading = ensure_pen(act, "act-reading", "Reading", "#a855f7")
    loc = next((sc for sc in tg["scopes"] if sc["id"] == "location"), None)
    mood = next((sc for sc in tg["scopes"] if sc["id"] == "mood"), None)
    comp = next((sc for sc in tg["scopes"] if sc["id"] == "company"), None)
    loc_ids = [p["id"] for p in loc["pens"][:4]] if loc else []
    mood_ids = [p["id"] for p in mood["pens"][:4]] if mood else []
    co_ids = [p["id"] for p in comp["pens"][:3]] if comp else []
    work_pens = [p["id"] for p in act["pens"] if p["id"].startswith("act-") and p["id"] not in ("act-sleep", "act-spent", "act-intake", "act-text-log", "act-switch")]
    taken = {}
    for e in entries:
        if e.get("kind") != "instant":
            for m in range(e["startMin"], e["endMin"]):
                taken.setdefault((e["date"], e["scopeId"]), set()).add(m)
    def free(date, scope, a, b):
        t = taken.get((date, scope), set())
        return all(m not in t for m in range(a, b))
    def take(date, scope, a, b):
        taken.setdefault((date, scope), set()).update(range(a, b))
    n = [0]
    def eid(date, tag):
        n[0] += 1
        return f"demo-{date}-{tag}{n[0]}"
    def inst(date, pen, minute, title, **kw):
        e = {"id": eid(date, "i"), "date": date, "scopeId": "activity", "penId": pen, "kind": "instant",
             "startMin": minute, "endMin": minute, "title": title}
        e.update(kw)
        entries.append(e)
    def cert(date_i):
        x = r.random()
        return ({"clockCertainty": "estimated", "precision": "estimated"} if x < 0.12 else
                {"clockCertainty": "unknown", "startMin": 0, "endMin": 0} if x < 0.18 else {})
    days = [(_d("2026-08-21") + _td(days=i)).isoformat() for i in range(61)]
    for di, day in enumerate(days):
        # spends
        for what, cents, src in r.sample(SPEND, r.randint(1, 3)):
            m = r.randint(420, 1250)
            inst(day, spent, m, what, eventKind="spend", spendAmount=cents + r.choice([0, 0, 35, 110]), spendOn=what, spendSource=src, **cert(di))
        # intake (food / drink / drug / bare)
        for cls in r.sample(["food", "drink", "drink", "food", "drug"], r.randint(2, 4)):
            what = r.choice(INTAKE[cls])
            inst(day, intake, r.randint(380, 1300), what, eventKind="intake." + cls, intakeClass=cls, **cert(di))
        if di % 5 == 0:
            inst(day, intake, r.randint(500, 900), "snack", eventKind="intake", **cert(di))
        # events + text log
        for ev in r.sample(EVENTS, r.randint(1, 3)):
            inst(day, textlog, r.randint(360, 1380), ev, eventKind=eventKindSlug(ev), **cert(di))
        # thought process, note
        if di % 2 == 0:
            t, body = r.choice(THOUGHTS)
            inst(day, textlog, r.randint(540, 1300), t, notes=body, eventKind="thought-process", generatedBy={"kind": "text", "id": day})
        if di % 3 == 0:
            t, body = r.choice(NOTES)
            inst(day, textlog, r.randint(480, 1200), t, notes=body, eventKind="note", generatedBy={"kind": "text", "id": day})
        # switch
        if di % 2 == 1:
            a, b = r.choice(SWITCHES)
            inst(day, switch, r.randint(480, 1200), f"started {b}", switchFrom=a, switchTo=b, eventKind="switch")
        # intervals: work/reading blocks in free windows
        for _ in range(r.randint(2, 3)):
            start = r.randrange(480, 1200, 15)
            length = r.choice([30, 45, 60, 90, 120])
            if start + length <= 1320 and free(day, "activity", start, start + length) and work_pens:
                pen = r.choice(work_pens)
                e = {"id": eid(day, "b"), "date": day, "scopeId": "activity", "penId": pen, "startMin": start, "endMin": start + length,
                     "title": r.choice(["deep work", "inbox sweep", "kitchen reset", "long walk", "call with a friend", "sketching"]),
                     "notes": r.choice(["Went smoothly.", "Interrupted twice; picked it back up.", "Good light, good pace."])}
                if r.random() < 0.3:
                    e["nowObjectives"] = [{"id": f"no-{n[0]}", "text": "finish the outline", "addedAt": f"{day}T10:00:00.000Z", "completedAt": f"{day}T10:40:00.000Z"}]
                if r.random() < 0.2 and co_ids:
                    e["secondaryPenIds"] = [r.choice(co_ids)]
                if r.random() < 0.2:
                    e["tagIds"] = ["tag-work"] if r.random() < 0.5 else ["tag-rest"]
                if r.random() < 0.1:
                    e["splitAfter"] = True
                entries.append(e); take(day, "activity", start, start + length)
        # reading block with project / books / pages
        if di % 4 == 0:
            s0 = r.randrange(1260, 1320, 15)
            if free(day, "activity", s0, s0 + 30):
                entries.append({"id": eid(day, "r"), "date": day, "scopeId": "activity", "penId": reading, "startMin": s0, "endMin": s0 + 30,
                                "title": "reading", "books": "The Quiet Orchard", "pages": r.randint(8, 40), "project": "winter reading"})
                take(day, "activity", s0, s0 + 30)
        # location + mood + company
        if loc_ids:
            s0 = r.randrange(360, 1080, 30)
            if free(day, "location", s0, s0 + 60):
                entries.append({"id": eid(day, "l"), "date": day, "scopeId": "location", "penId": r.choice(loc_ids), "startMin": s0, "endMin": s0 + 60})
                take(day, "location", s0, s0 + 60)
        if mood_ids and di % 2 == 0:
            w, tone, sens, narr = r.choice(MOODS)
            s0 = r.randrange(540, 1200, 30)
            if free(day, "mood", s0, s0 + 30):
                entries.append({"id": eid(day, "m"), "date": day, "scopeId": "mood", "penId": r.choice(mood_ids), "startMin": s0, "endMin": s0 + 30,
                                "moodReading": {"word": w, "sensation": sens, "vibe": w, "narrative": narr, "tone": tone, "energy": r.randint(2, 9), "tension": r.randint(1, 8), "enjoyment": r.randint(2, 9)}})
                take(day, "mood", s0, s0 + 30)
        # a block crossing midnight (two slices, one span)
        if di % 9 == 0 and day < days[-1]:
            nxt = days[di + 1]
            if free(day, "activity", 1380, 1440) and free(nxt, "activity", 0, 90) and work_pens:
                sp = f"span-{day}"
                pen = r.choice(work_pens)
                entries.append({"id": eid(day, "s"), "date": day, "scopeId": "activity", "penId": pen, "startMin": 1380, "endMin": 1440, "spanId": sp, "title": "late reading"})
                entries.append({"id": eid(nxt, "s"), "date": nxt, "scopeId": "activity", "penId": pen, "startMin": 0, "endMin": 90, "spanId": sp, "title": "late reading"})
                take(day, "activity", 1380, 1440); take(nxt, "activity", 0, 90)
    # untracked notes
    un = tg.setdefault("untrackedNotes", {})
    for day in days[::10]:
        un[f"{day}|activity|600|660"] = "Gap: errands and a long call, not painted."
    # summaries (day / week / month / season / year) in the day-notes map
    dn = out["stores"]["brain2-tracking-day-notes"]
    def pack(text, when):
        return json.dumps({"v": 1, "entries": [{"id": f"al_demo-{abs(hash(text)) % 10**8}", "createdAt": when, "text": text}]}, separators=(",", ":"))
    for i, day in enumerate(days):
        dn.setdefault(day, pack(SUMMARY[i % len(SUMMARY)], f"{day}T21:00:00.000Z"))
    for i in range(0, len(days) - 6, 7):
        wk = f"{days[i]}_{days[i + 6]}"
        dn.setdefault(f"week:{wk}", pack(WEEK_SUM[(i // 7) % 2], f"{days[i + 6]}T21:30:00.000Z"))
    dn.setdefault("month:2026-09", pack("September: settled into a rhythm. Reading up, spending steady, two long walks a week.", "2026-09-30T21:30:00.000Z"))
    dn.setdefault("month:2026-10", pack("October so far: travel prep and a tidier kitchen. Sleep is the thing to fix.", "2026-10-19T21:30:00.000Z"))
    dn.setdefault("quarter:2026-Q3", pack("Season summary: built the habit stack, learned what a plan can and cannot do.", "2026-09-30T22:00:00.000Z"))
    dn.setdefault("year:2026", pack("Year so far: fewer projects, finished more of them.", "2026-10-19T22:00:00.000Z"))
    # reviews with reasoning / analysis
    rv = out["stores"]["brain2-reviews-store"]["state"]["reviews"]
    have = {x["periodKey"] for x in rv if x.get("period") == "day"}
    for i, day in enumerate(days[::2]):
        if day in have:
            continue
        refl = {k: v for k, v in r.sample(REASON, 3)} if False else {"wentWell": REASON[0][1], "improve": REASON[1][1], "learned": REASON[2][1]}
        rv.append({"id": f"day:{day}", "period": "day", "periodKey": day, "completedAt": f"{day}T21:15:00.000Z", "summary": SUMMARY[i % len(SUMMARY)],
                   "gratitude": ["a quiet morning", "good soup", "a friend's call"], "nextPlans": "Outline first, errands second.",
                   "reflections": refl, "resolvedTaskIds": [], "pushedTaskIds": []})
    # metrics datapoints
    md = out["stores"]["brain2-metrics-store"]["state"]["datapoints"]
    for i, day in enumerate(days[::3]):
        md.append({"id": f"dp-demo-{day}", "at": f"{day}T19:30", "values": {"joy": r.randint(40, 90), "suffering": r.randint(0, 30), "alignment": r.randint(35, 85),
                   "selfSatisfaction": r.randint(30, 80), "situationalSatisfaction": r.randint(40, 90)},
                   "context": r.choice(["after a walk", "end of workday", "post-dinner"]), "details": "Reasoning: felt aligned when the plan was small.", "createdAt": f"{day}T19:31:00.000Z"})
    # sleep nights
    nights = out["stores"]["brain2-sleep-store"]["state"]["nights"]
    for day in days:
        if day not in nights:
            nights[day] = {"date": day, "sleptMin": r.choice([-60, -30, 0, 30, 60]), "sleptPrecision": r.choice(["estimated", "definite"]),
                           "wokeMin": r.randrange(390, 570, 15), "wokePrecision": r.choice(["estimated", "definite"]), "updatedAt": f"{day}T07:00:00.000Z"}
    # ingest events: every intent kind, several statuses
    ig = out["stores"]["brain2-ingest-store"]["state"]
    chat = ig["allowedChats"][0]["chatId"] if ig.get("allowedChats") else "100000001"
    evs = ig["events"]
    for i, (kind, raw, summ, status) in enumerate(INTENTS * 2):
        day = days[(i * 3) % len(days)]
        evs.append({"id": f"ing-demo-{i}", "at": f"{day}T{8 + i % 12:02d}:{(i * 7) % 60:02d}:00.000Z", "channel": "telegram" if i % 5 else "simulate",
                    "chatId": chat, "userId": chat, "raw": raw, "kind": kind, "status": status, "summary": summ, "telegramMessageId": 9000 + i,
                    "dedupeKey": f"msg:demo{i}"})
    evs.sort(key=lambda e: e["at"], reverse=True)
    # calendar events and planned actions
    ev = out["stores"]["brain2-event-storage"]["state"]["events"]
    for i, day in enumerate(days[::6]):
        ev.append({"id": f"ev-demo-{i}", "title": r.choice(["Dentist", "Pottery class", "Book club", "Farmers market", "Train to the coast"]),
                   "startTime": "10:00", "endTime": "11:30", "date": day, "type": "event", "color": "#6366f1", "isScheduled": True, "isAllDay": False, "location": "", "description": ""})
    pa = out["stores"]["brain2-planned-actions"]["state"]["actions"]
    for i, day in enumerate(days[-14::2]):
        pa.append({"id": f"plan-demo-{i}", "date": day, "startTime": "09:00", "endTime": "09:45", "title": "outline the essay", "notes": "", "source": "manual"})
    # plan text: day plans for the last 3 weeks
    for day in days[-21:]:
        out["planText"].setdefault(f"dayPlan-{day}", "09:00 outline\n10:30 errands ==> library\nlunch\n14:00 deep work\n18:00 walk")


def eventKindSlug(phrase):
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]+", "", phrase.lower())).strip()


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    seed = 7
    if "--seed" in sys.argv:
        seed = int(sys.argv[sys.argv.index("--seed") + 1])
    if len(args) < 2:
        sys.exit(__doc__)
    src = json.load(open(args[0]))
    sc = Scrubber(seed)
    sc.prepass_geo(src)
    out = {"app": src["app"], "version": src["version"], "exportedAt": src["exportedAt"], "dataProfile": "demo"}
    out["stores"] = sc.scrub(src["stores"])
    out["planText"] = {sc.scrub_key(k): sc.scrub_str(v, "planText") for k, v in src["planText"].items()}
    out["extras"] = {sc.scrub_key(k): sc.scrub_str(v, k) for k, v in src.get("extras", {}).items()}
    out["attachments"] = {k: fake_attachment(k, v, sc) for k, v in src.get("attachments", {}).items()}
    docs = []
    for d in src.get("docs", []):
        docs.append({
            "id": d["id"], "title": sc.scrub_str(d["title"], "title"), "folder": sc.scrub_str(d["folder"], "folder"),
            "fontFamily": d["fontFamily"], "status": d["status"],
            "body": sc.scrub_longform(d["body"], "body") if len(d["body"]) > 160 else sc.scrub_str(d["body"], "body"),
            "createdAt": d["createdAt"], "updatedAt": d["updatedAt"],
        })
    out["docs"] = docs
    if "--no-enrich" not in sys.argv:
        enrich(out, seed)
    json.dump(out, open(args[1], "w"), ensure_ascii=False, separators=(",", ":"))
    print("wrote", args[1], os.path.getsize(args[1]) // 1024, "KB", sc.stats)


if __name__ == "__main__":
    main()
