# Weitblick

Fragen mit Quellen und ein Nachrichten-Feed mit Abschalten. Eine Web-App (PWA) auf GitHub Pages.

- **Nachrichten**: `data/feed.json` wird alle 2 Stunden von GitHub Actions aus öffentlichen RSS-Feeds gebaut (SRF, NZZ, Tagesschau, heise, Golem, Spektrum, finews). Ist das Repo-Secret `GEMINI_API_KEY` gesetzt, schreibt Gemini kurze Zusammenfassungen, nur aus dem Text der Quelle.
- **Fragen**: Antworten mit nummerierten Quellen. Google Gemini sucht direkt bei Google. Groq, Mistral und OpenRouter antworten als Ersatz aus Wikipedia und dem Nachrichten-Feed.
- Zugänge für die KIs bleiben nur auf dem Handy, verschlüsselt mit einer PIN. Sie sind nie im Code oder im Repo.

## Kurse (ab v3)
- Quelle: Yahoo Finance Chart-Schnittstelle (inoffiziell, ohne Zugang, nur für persönlichen Gebrauch), verzögert ca. 15–20 Min.
- Abruf nur serverseitig per GitHub Actions (`.github/workflows/quotes.yml`, `scripts/build_quotes.py`) etwa alle 30 Min. werktags 08–22 Uhr → `data/quotes.json`, `data/hist/*.json`.
- Instrumente kuratiert in `data/instruments.json`; unklare Zuordnung = keine Kursanzeige (z. B. Roche, „Google“).
- Bei Fehlern bleibt der letzte gute Stand, als veraltet markiert. Keine Daten = keine Anzeige. Kosten: 0. Nichts Geheimes nötig.
