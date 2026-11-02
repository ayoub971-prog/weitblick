#!/usr/bin/env python3
"""Baut data/feed.json aus oeffentlichen RSS-Feeds. Optional: KI-Zusammenfassung mit GEMINI_API_KEY (nur aus dem RSS-Text, nichts erfinden)."""
import json, os, re, html, hashlib, time, urllib.request, xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from datetime import datetime, timezone

FEEDS = [
  ("SRF", "Schweiz", "https://www.srf.ch/news/bnf/rss/1890"),
  ("SRF", "Welt", "https://www.srf.ch/news/bnf/rss/1922"),
  ("SRF", "Wirtschaft", "https://www.srf.ch/news/bnf/rss/1926"),
  ("SRF", "Sport", "https://www.srf.ch/sport/bnf/rss/718"),
  ("NZZ", "Wirtschaft", "https://www.nzz.ch/wirtschaft.rss"),
  ("NZZ", "Tech", "https://www.nzz.ch/technologie.rss"),
  ("NZZ", "Wissenschaft", "https://www.nzz.ch/wissenschaft.rss"),
  ("Tagesschau", "Welt", "https://www.tagesschau.de/xml/rss2/"),
  ("Tagesschau", "Wirtschaft", "https://www.tagesschau.de/wirtschaft/index~rss2.xml"),
  ("Tagesschau", "Wissenschaft", "https://www.tagesschau.de/wissen/index~rss2.xml"),
  ("heise", "Tech", "https://www.heise.de/rss/heise-atom.xml"),
  ("Golem", "Tech", "https://www.golem.de/rss.php?feed=RSS2.0"),
  ("Spektrum", "Wissenschaft", "https://www.spektrum.de/alias/rss/spektrum-de-rss-feed/996406"),
  ("finews", "Wirtschaft", "https://www.finews.ch/news?format=feed"),
]
PER_FEED = 15
MAX_AGE_H = 72
NS = {"a": "http://www.w3.org/2005/Atom", "media": "http://search.yahoo.com/mrss/", "content": "http://purl.org/rss/1.0/modules/content/"}

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Weitblick feed builder)"})
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.read()

def clean(s):
    s = html.unescape(re.sub(r"<[^>]+>", " ", s or ""))
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"\s*(Weiterlesen|mehr\s*…|\[…\]|\[\.\.\.\])\s*$", "", s)
    return s.replace("ß", "ss")

def first_img(*texts):
    for t in texts:
        m = re.search(r'<img[^>]+src="([^"]+)"', html.unescape(t or ""))
        if m: return m.group(1)
    return ""

def pdate(s):
    if not s: return None
    try: return parsedate_to_datetime(s).astimezone(timezone.utc)
    except Exception: pass
    try: return datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(timezone.utc)
    except Exception: return None

def parse(src, topic, data):
    root = ET.fromstring(data); out = []
    items = root.findall(".//item") or root.findall(".//a:entry", NS)
    for it in items[:PER_FEED]:
        t = lambda tag: (it.findtext(tag, default="", namespaces=NS) or "")
        title = clean(t("title") or t("a:title"))
        link = t("link").strip()
        if not link:
            l = it.find("a:link", NS); link = l.get("href", "") if l is not None else ""
        desc_raw = t("description") or t("a:summary") or t("content:encoded") or t("a:content")
        img = ""
        for tag in ("media:content", "media:thumbnail", "enclosure"):
            e = it.find(tag, NS)
            if e is not None and e.get("url") and (tag != "enclosure" or "image" in (e.get("type") or "image")):
                img = e.get("url"); break
        img = img or first_img(desc_raw, t("content:encoded"))
        d = pdate(t("pubDate") or t("a:updated") or t("a:published"))
        if not title or not link: continue
        out.append({"id": hashlib.sha1(link.encode()).hexdigest()[:12], "title": title, "link": link,
                    "text": clean(desc_raw)[:600], "img": img if img.startswith("https://") else "",
                    "source": src, "topic": topic, "date": d.isoformat() if d else ""})
    return out

def gemini_summaries(items, key):
    """Fasst je Artikel NUR den RSS-Text in 2 vollen Saetzen zusammen."""
    model = "gemini-flash-latest"; url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    done = 0
    for i in range(0, len(items), 20):
        batch = items[i:i + 20]
        lst = "\n".join(f'{j}. Titel: {x["title"]}\n   Text: {x["text"]}' for j, x in enumerate(batch))
        prompt = ("Fasse jeden Artikel in 1 bis 2 vollstaendigen, klaren deutschen Saetzen (Schweizer Schreibweise, 'ss' statt 'ß') zusammen. "
                  "Verwende NUR Informationen aus Titel und Text. Erfinde nichts, keine Zahlen oder Namen, die nicht dastehen. "
                  'Antworte als JSON-Liste: [{"i":0,"s":"..."}]\n\n' + lst)
        body = json.dumps({"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"}}).encode()
        try:
            req = urllib.request.Request(url, data=body, headers={"content-type": "application/json", "x-goog-api-key": key})
            with urllib.request.urlopen(req, timeout=90) as r: j = json.load(r)
            txt = j["candidates"][0]["content"]["parts"][0]["text"]
            for o in json.loads(txt):
                k = int(o.get("i", -1)); s = (o.get("s") or "").strip().replace("ß", "ss")
                if 0 <= k < len(batch) and len(s) > 20: batch[k]["sum"] = s; batch[k]["ai"] = True; done += 1
        except Exception as e:
            print("Gemini-Fehler:", str(e)[:200]); 
            if "429" in str(e): break
        time.sleep(5)
    return done

def main():
    os.makedirs("data", exist_ok=True)
    old = {}
    try:
        for x in json.load(open("data/feed.json", encoding="utf-8")).get("items", []):
            if x.get("ai"): old[x["id"]] = x["sum"]
    except Exception: pass
    items, seen, errors = [], set(), []
    now = datetime.now(timezone.utc)
    for src, topic, url in FEEDS:
        try:
            for x in parse(src, topic, get(url)):
                if x["id"] in seen: continue
                if x["date"] and (now - datetime.fromisoformat(x["date"])).total_seconds() > MAX_AGE_H * 3600: continue
                seen.add(x["id"]); items.append(x)
        except Exception as e:
            errors.append(f"{src}/{topic}: {str(e)[:80]}")
    items.sort(key=lambda x: x["date"], reverse=True)
    for x in items:
        if x["id"] in old: x["sum"] = old[x["id"]]; x["ai"] = True
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    todo = [x for x in items if not x.get("ai") and x["text"]][:80]
    n = gemini_summaries(todo, key) if key and todo else 0
    for x in items:
        if not x.get("sum"): x["sum"] = x["text"]
    json.dump({"updated": now.isoformat(timespec="seconds"), "ai": bool(key), "errors": errors, "items": items},
              open("data/feed.json", "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    print(f"{len(items)} Artikel, {n} neu von KI zusammengefasst, Fehler: {errors}")

if __name__ == "__main__":
    main()
