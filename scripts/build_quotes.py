#!/usr/bin/env python3
"""Holt Kurse + Verlauf fuer data/instruments.json von Yahoo Finance (inoffizielle, schluessellose Chart-Schnittstelle).
Schreibt data/quotes.json (ein gemeinsamer Datenstand fuer Kursanzeige und Kurskarte) und data/hist/<id>.json.
Bei Fehlern bleibt der letzte gute Wert erhalten und wird als veraltet markiert. Nichts wird geschaetzt oder erfunden."""
import json, time, urllib.request, urllib.parse, os
from datetime import datetime, timezone

UA = {"User-Agent": "Mozilla/5.0 (Weitblick quotes builder)"}
def now_iso(): return datetime.now(timezone.utc).replace(microsecond=0).isoformat()
def iso(ts): return datetime.fromtimestamp(ts, timezone.utc).replace(microsecond=0).isoformat() if ts else None

def chart(sym, rng, interval):
    err = None
    for host in ("query1", "query2"):
        url = "https://%s.finance.yahoo.com/v8/finance/chart/%s?range=%s&interval=%s&includePrePost=false" % (host, urllib.parse.quote(sym, safe=""), rng, interval)
        for t in range(2):
            try:
                with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20) as r:
                    d = json.load(r)
                res = (d.get("chart") or {}).get("result")
                if res: return res[0]
                err = RuntimeError(str((d.get("chart") or {}).get("error")))
            except Exception as e:
                err = e; time.sleep(1.5)
    raise err

def pts(res, nd=4):
    ts = res.get("timestamp") or []
    try: c = res["indicators"]["quote"][0]["close"]
    except Exception: return []
    return [[t, round(v, nd)] for t, v in zip(ts, c) if v is not None]

def session(meta, t):
    p = meta.get("currentTradingPeriod") or {}
    reg = p.get("regular") or {}
    if reg.get("start") and reg.get("end"):
        if reg["start"] <= t <= reg["end"] and time.time() <= reg["end"] + 900: return "regulär"
        return "Schlusskurs"
    return None

def main():
    inst = json.load(open("data/instruments.json", encoding="utf-8"))["items"]
    try: old = json.load(open("data/quotes.json", encoding="utf-8"))
    except Exception: old = {"quotes": {}}
    gen = now_iso(); Q = {}; errs = []; curs = set()
    for it in inst:
        i, sym = it["id"], it["yahoo"]
        try:
            r1 = chart(sym, "1d", "5m"); m = r1["meta"]
            price, prev, mt = m.get("regularMarketPrice"), m.get("chartPreviousClose"), m.get("regularMarketTime")
            if price is None or not prev or not mt: raise RuntimeError("unvollstaendige Kursdaten")
            chg = price - prev
            hist = {"gen": gen, "d1": pts(r1)}
            time.sleep(0.4)
            try: hist["d5"] = pts(chart(sym, "5d", "30m"))
            except Exception as e: errs.append("%s 5d: %s" % (i, e))
            time.sleep(0.4)
            try: hist["y1"] = pts(chart(sym, "1y", "1d"))
            except Exception as e: errs.append("%s 1y: %s" % (i, e))
            # Verlauf endet genau beim Kurs des Datenstands (gleiche Datenbasis wie die Anzeige)
            if hist["d1"] and hist["d1"][-1][0] < mt: hist["d1"].append([mt, round(price, 4)])
            hist["prev"] = round(prev, 4)
            json.dump(hist, open("data/hist/%s.json" % i, "w"), separators=(",", ":"))
            cur = m.get("currency"); curs.add(cur)
            Q[i] = {"price": round(price, 4), "prev_close": round(prev, 4), "change": round(chg, 4), "pct": round(chg / prev * 100, 3),
                    "currency": cur, "exchange_feed": m.get("fullExchangeName") or m.get("exchangeName"), "market_time": iso(mt),
                    "exchange_tz": m.get("exchangeTimezoneName"), "session": session(m, mt), "fetched": gen, "stale": False}
        except Exception as e:
            errs.append("%s: %s" % (i, e))
            o = (old.get("quotes") or {}).get(i)
            if o: o = dict(o); o["stale"] = True; o["error"] = "Abruf fehlgeschlagen, letzter guter Stand"; Q[i] = o; curs.add(o.get("currency"))
        time.sleep(0.4)
    fx = dict((old.get("fx") or {}))
    for c in sorted(x for x in curs if x and x not in ("CHF",)):
        base = "GBP" if c == "GBp" else c
        try:
            m = chart("%sCHF=X" % base, "1d", "1d")["meta"]
            fx[c] = {"rate": round(m["regularMarketPrice"] / (100 if c == "GBp" else 1), 6), "time": iso(m.get("regularMarketTime"))}
        except Exception as e: errs.append("fx %s: %s" % (c, e))
    out = {"generated": gen, "source": "Yahoo Finance (inoffizielle Chart-Schnittstelle, ohne Konto)", "delay_note": "Verzögert: je nach Börse ca. 15–20 Minuten, dazu Abruf nur etwa alle 30 Minuten während der Handelszeit.",
           "ok": len([1 for q in Q.values() if not q.get("stale")]), "errors": errs[:30], "quotes": Q, "fx": fx}
    json.dump(out, open("data/quotes.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("ok", out["ok"], "von", len(inst), "Fehler:", len(errs))
    for e in errs[:10]: print(" ", e)

if __name__ == "__main__": main()
