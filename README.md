# Weitblick

Fragen mit Quellen und ein Nachrichten-Feed mit Abschalten. Eine Web-App (PWA) auf GitHub Pages.

- **Nachrichten**: `data/feed.json` wird alle 2 Stunden von GitHub Actions aus öffentlichen RSS-Feeds gebaut (SRF, NZZ, Tagesschau, heise, Golem, Spektrum, finews). Ist das Repo-Secret `GEMINI_API_KEY` gesetzt, schreibt Gemini kurze Zusammenfassungen, nur aus dem Text der Quelle.
- **Fragen**: Antworten mit nummerierten Quellen. Google Gemini sucht direkt bei Google. Groq, Mistral und OpenRouter antworten als Ersatz aus Wikipedia und dem Nachrichten-Feed.
- Zugänge für die KIs bleiben nur auf dem Handy, verschlüsselt mit einer PIN. Sie sind nie im Code oder im Repo.
