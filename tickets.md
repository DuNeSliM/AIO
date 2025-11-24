# AIO Game Library – Umsetzungs-Backlog (Ticket-Style)

> Hinweis: Tickets sind nach Phasen und grober Implementierungsreihenfolge sortiert.

---

## PHASE 1 – Core Foundations

### TICKET-001 – Projekt-Setup & Basis-Infrastruktur

**Beschreibung**
- Monorepo/Workspace-Struktur für Backend (Go/TS), Frontend (Tauri) und Docs anlegen.
- Basis-Build-/Dev-Skripte definieren.
- Linter/Formatter, Git Hooks, CI-Grundlage.

**Akzeptanzkriterien**
- `backend` und `frontend` lassen sich lokal starten.
- Einheitliche Code-Style- und Lint-Regeln vorhanden.
- README mit Kurzbeschreibung, Tech-Stack, Startanleitung.

---

### TICKET-002 – User-Datenbank-Schema & Migrationen

**Beschreibung**
- DB-Schema für User, Sessions/Tokens vorbereiten.
- Migrationen anlegen und Skript zum Ausführen erstellen.

**Akzeptanzkriterien**
- Tabellen: `users`, `sessions` (oder `refresh_tokens`) existieren.
- Migrationen können lokal wiederholt gefahren werden.
- Basis-Indizes (E-Mail unique, etc.) vorhanden.

---

### TICKET-003 – Account-Erstellung (Registrierung)

**Beschreibung**
- Endpoint zur Registrierung mit E-Mail + Passwort.
- Passwort-Hashing (z. B. bcrypt/argon2).
- Optionale E-Mail-Verifikation vorsehen (Feature-Flag).

**Akzeptanzkriterien**
- `POST /auth/register` erstellt neuen User mit gehashtem Passwort.
- Doppelte E-Mails werden sauber abgewiesen.
- (Optional) Verifikations-Token und Statusfeld in DB.

---

### TICKET-004 – Login & Logout (Auth-Flow)

**Beschreibung**
- Login-Endpoint mit E-Mail + Passwort.
- JWT oder Session-basierte Auth implementieren (Access + Refresh Tokens).
- Logout-Mechanismus (Blacklist/Token-Invalidierung).

**Akzeptanzkriterien**
- `POST /auth/login` gibt gültiges Token/Session zurück.
- `POST /auth/logout` invalidiert aktuelle Session.
- Geschützte Routen prüfen Authentifizierung.

---

### TICKET-005 – User-Profil-API (Lesen & Bearbeiten)

**Beschreibung**
- Endpoints für:
  - Profil anzeigen
  - Username, Avatar, E-Mail ändern
  - Passwort ändern
  - Account löschen (Soft-Delete oder Hard-Delete definieren)

**Akzeptanzkriterien**
- Authentifizierter User kann eigene Daten lesen/ändern.
- Passwortänderung verlangt aktuelles Passwort.
- Delete führt zu sauberem Entfernen/Deaktivieren.

---

### TICKET-006 – DB-Schema für Spiele & Bibliothek

**Beschreibung**
- Zentrales Schema für:
  - `games` (Spiel-Masterdaten)
  - `installed_games`
  - `wishlists`
  - `hidden_games`
  - `game_groups`
  - `store_integrations`
- Beziehung User ↔ Library definieren.

**Akzeptanzkriterien**
- Tabellen sind angelegt und per Migration ausrollbar.
- Primär-/Fremdschlüssel und nötige Indizes existieren.
- Basic-Constraints (NOT NULL, UNIQUE, etc.).

---

### TICKET-007 – Caching-Layer für Store-APIs

**Beschreibung**
- Einfachen Cache für Antworten von Steam/GOG/etc. definieren (DB- oder Filesystem-basiert).
- TTL pro API-Typ konfigurieren (z. B. Owned Games vs. Prices).

**Akzeptanzkriterien**
- Cache-Tabelle/-Struktur vorhanden.
- API-Aufrufe verwenden Cache bei wiederholten Requests.
- Config für TTLs pro Provider vorhanden.

---

### TICKET-008 – Store-Integrations-Framework-Interface

**Beschreibung**
- Gemeinsames Interface/Abstraktion für Store-Clients:
  - Auth
  - Owned Games
  - Installed Games (falls möglich)
  - Game-Metadaten
  - Preise/Discounts
  - Launch-Befehle

**Akzeptanzkriterien**
- Ein zentrales Interface (z. B. `StoreClient`) mit klaren Methoden.
- Fehler- und Rate-Limit-Handling definiert.
- Unit-Tests für ein Dummy-Store-Implementation.

---

### TICKET-009 – Lokale Launcher-Erkennung (Basis)

**Beschreibung**
- Windows-spezifische Erkennung installierter Launcher:
  - Steam, Epic, GOG, Xbox, etc.
- Nutzung von Registry, Standardpfaden, Konfigdateien.

**Akzeptanzkriterien**
- Funktion/Service, die erkannte Launcher mitsamt Pfaden zurückgibt.
- Erkennung funktioniert mind. für Steam + Epic.
- Fehler/Fehlende Launcher werden protokolliert.

---

## PHASE 2 – Store Integrations

### TICKET-010 – Steam-Integration (Auth + Library)

**Beschreibung**
- Steam-Account-Verknüpfung (API-Key / OAuth / Web-Login, je nach Strategie).
- Abruf der Library (owned games).
- Mapping zu internem `games`-Schema.

**Akzeptanzkriterien**
- Nutzer kann Steam-Konto verbinden/trennen.
- API-Call, der Steam-Spiele für User abruft und speichert.
- Basis-Fehler-Handling (z. B. private Profile, API-Rate-Limits).

---

### TICKET-011 – Steam – Installed Games & Launch

**Beschreibung**
- Lokale Steam-Installationen erkennen (Manifeste).
- Steam-Spiele starten (`steam://rungameid/...`).

**Akzeptanzkriterien**
- Installierte Steam-Spiele werden User zugeordnet.
- Launch aus App heraus öffnet Steam und startet Spiel.
- Fehlermeldung bei fehlender Installation.

---

### TICKET-012 – Epic Games Store – Integration (Account + Library)

**Beschreibung**
- EGS-Account-Verknüpfung.
- Owned Games abrufen.
- Mapping zu internem Spiel-Datensatz.

**Akzeptanzkriterien**
- Nutzer kann Epic verknüpfen/trennen.
- Library-Sync funktioniert, Doppelspiele werden gemappt.
- Fehler bei abgelaufenen Tokens werden behandelt.

---

### TICKET-013 – GOG Galaxy – Integration (Account + Library)

**Beschreibung**
- GOG-Account-Verknüpfung.
- Owned Games und (falls möglich) Installed Games abrufen.

**Akzeptanzkriterien**
- Nutzer kann GOG verbinden.
- GOG-Spiele erscheinen in der Unified Library.
- Basis-Logging bei API-Fehlern.

---

### TICKET-014 – Xbox/Microsoft Store – Basis-Integration

**Beschreibung**
- Account-Linking über Microsoft OAuth.
- Abruf von PC-kompatiblen Spielen (soweit API erlaubt).

**Akzeptanzkriterien**
- User kann MS-Konto verbinden.
- PC-Spiele (Game Pass, Käufe) erscheinen rudimentär in Library.
- Einschränkungen sind dokumentiert.

---

### TICKET-015 – Weitere Stores (Battle.net, Ubisoft, EA, Riot, Amazon)

**Beschreibung**
- Pro Store minimalen Integrationsumfang definieren:
  - Account-Linking
  - Library-Fetch
  - Launch-Befehl (wenn möglich)

**Akzeptanzkriterien**
- Je Store ein Client-Skelett + TODOs.
- Mindestens 1 weiterer Store neben Steam/Epic/GOG praxistauglich umgesetzt.
- Gemeinsame Fehlerbehandlung über Framework.

---

## PHASE 3 – Library & Wishlist Features

### TICKET-016 – Unified Game-Merging-Logik

**Beschreibung**
- Spiele aus verschiedenen Stores auf einen Master-Game-Eintrag mappen.
- Heuristiken: AppID-Mapping, Namen, Publisher, ggf. manuelle Zusammenführung.

**Akzeptanzkriterien**
- Ein Spiel, das auf Steam+Epic besitzt, erscheint nur einmal in der Bibliothek.
- Quell-Stores sind am Game-Eintrag erkennbar.
- Dublettenstrategie dokumentiert.

---

### TICKET-017 – Library-API (Liste, Suche, Filter)

**Beschreibung**
- Endpoints für:
  - Library-Liste des Users
  - Suche nach Spielen
  - Filter (installiert, Store, Genre, Tags, versteckt)

**Akzeptanzkriterien**
- `GET /library` mit Query-Parametern für Filter.
- Paginierung implementiert.
- Response beinhaltet genug Metadaten für UI (Icons, Status).

---

### TICKET-018 – Game-Gruppen / Collections

**Beschreibung**
- Gruppen-Entitäten für vom User erstellte Sammlungen.
- Spiele zu Gruppen hinzufügen/entfernen.

**Akzeptanzkriterien**
- API für CRUD auf Gruppen.
- Spiele können mehreren Gruppen zugeordnet sein.
- (Optional) Custom-Icons/Farben-Feld in DB vorgesehen.

---

### TICKET-019 – Spiele verstecken (Hide/Unhide)

**Beschreibung**
- Mechanismus zum Verstecken von Spielen in Library und Store-Listen.

**Akzeptanzkriterien**
- `POST /library/hide` und `POST /library/unhide`.
- Versteckte Spiele werden standardmäßig nicht im Standard-Listing gezeigt.
- User kann Hidden-Filter aktivieren.

---

### TICKET-020 – Game-Detailseite – Backend-API

**Beschreibung**
- API für:
  - Spiel-Details (Beschreibung, Cover, Metadaten)
  - (Wenn möglich) Spielzeit, Freunde, Achievements (erste Version: nur Metadaten)

**Akzeptanzkriterien**
- `GET /games/{id}` liefert alle benötigten Infos für Detailansicht.
- Fallback-Bilder/Placeholder bei fehlenden Assets.

---

### TICKET-021 – Store-Preisvergleich (Backend)

**Beschreibung**
- Preise/Discounts pro Store für ein Spiel abrufen und cachen.
- Normalpreis, Sale-Preis, Rabatt in %.

**Akzeptanzkriterien**
- `GET /games/{id}/prices` liefert Liste pro Store.
- Cache-Strategie (z. B. 1–6h TTL) implementiert.
- Basis-Konversion auf eine Standardwährung oder Währungsfeld im Response.

---

### TICKET-022 – Wishlists – Basis-API

**Beschreibung**
- Custom-Wishlists für User:
  - Erstellen, Umbenennen, Löschen
  - Spiele hinzufügen/entfernen

**Akzeptanzkriterien**
- `GET/POST/PUT/DELETE /wishlists`.
- Wunschliste wird mit Spiel-Referenzen gespeichert.
- Konsistenz bei Löschen von Spielen gewährleistet.

---

### TICKET-023 – Steam-Wishlist-Import

**Beschreibung**
- Importfunktion für Steam-Wishlist basierend auf verknüpftem Steam-Konto.

**Akzeptanzkriterien**
- `POST /wishlists/import/steam` legt neue Liste an oder merged, je nach Einstellung.
- Fehlende Spiele werden nach Möglichkeit neuen Game-Einträgen zugeordnet.
- Rate-Limit-Handling für Steam-API.

---

## PHASE 4 – Funktionale Erweiterungen

### TICKET-024 – Notification-Service – Basis

**Beschreibung**
- Allgemeine Notification-Entität + Versandkanal-Design:
  - In-App-Notifications (zuerst)
  - (Optional) E-Mail-Support vorbereiten, aber noch nicht aktiv.

**Akzeptanzkriterien**
- Tabelle `notifications` + einfacher Zustellstatus.
- API zum Abrufen und als gelesen markieren.
- Backend-Helpers zum Erzeugen von Notifications.

---

### TICKET-025 – Price-Drop-Alerts

**Beschreibung**
- User können für Wishlist-Spiele Preisalarm aktivieren.
- Hintergrundjob, der Preise checkt und bei Unterschreitung benachrichtigt.

**Akzeptanzkriterien**
- Schwellenwert (ab x % Rabatt oder ab bestimmtem Preis) konfigurierbar.
- Benachrichtigung wird einmalig bei Erreichen des Triggers verschickt.
- Job-Intervall konfigurierbar.

---

### TICKET-026 – Auto-Detect Installed Games (Multi-Store)

**Beschreibung**
- Dateisystem-/Manifest-Scanning für:
  - Steam, Epic, GOG (und ggf. weitere).
- Custom-Pfade konfigurierbar.

**Akzeptanzkriterien**
- Scan-Service, der komplette Liste installierter Spiele zurückgibt.
- Mapping auf interne Spieleinträge.
- Benutzer kann Scan manuell triggern.

---

### TICKET-027 – Downloads über App anstoßen (URI/Launcher)

**Beschreibung**
- Für Stores mit URI-Scheme (z. B. Steam): Install-Trigger.
- Für andere: Launcher öffnen und Produktseite aufrufen.

**Akzeptanzkriterien**
- Funktion/Endpoint: `POST /games/{id}/install`.
- Bei Nicht-Unterstützung: sinnvolle Fehlermeldung.
- Saubere Abstraktion in Store-Client-Interface.

---

### TICKET-028 – Manuelle Spiele („Stranger-Games“) – Basis

**Beschreibung**
- User kann eigenes Spiel hinzufügen:
  - Name, Executable-Pfad, Cover (URL/Upload), Tags.

**Akzeptanzkriterien**
- CRUD-API für manuelle Game-Einträge.
- Manuelle Spiele erscheinen in Unified Library.
- Launch über Pfad funktioniert.

---

## PHASE 5 – Stats & Social

### TICKET-029 – Lokale Spielzeit-Tracking-Engine

**Beschreibung**
- Tauri/Clientseitige Logik, um Start/Stopp eines Spiels zu erkennen.
- Spielzeit lokal sammeln und an Backend syncen.

**Akzeptanzkriterien**
- Spielzeit wird pro Session aufgezeichnet.
- Mind. Sekunden-/Minutengenauigkeit.
- Backend speichert kumulative Zeit pro User+Game.

---

### TICKET-030 – Steam-Stats-Import (Playtime & Achievements – Basis)

**Beschreibung**
- Steam-spezifische Endpoints nutzen, um:
  - Playtime
  - (später) Achievements
  zu importieren.

**Akzeptanzkriterien**
- Playtime wird aus Steam gelesen und mit lokalen Daten zusammengeführt.
- Konfliktstrategie (lokal vs. Steam) dokumentiert.
- API zur Abfrage von Stats pro Spiel/User.

---

### TICKET-031 – User-Profile & Friends (AIO-intern)

**Beschreibung**
- Einfache „AIO-Freunde“ ohne direkte Kopplung an Steam/Xbox:
  - Freundesanfragen
  - Freunde-Liste
  - Vergleich von Library/Playtime.

**Akzeptanzkriterien**
- API: Freund anfragen, annehmen, ablehnen, entfernen.
- `GET /users/{id}/profile` zeigt öffentliche Daten + geteilte Spiele.
- Privacy-Einstellungen-Felder vorgesehen (spätere Phase).

---

## PHASE 6 – UI/UX & Settings

### TICKET-032 – UI-Shell (Tauri-Frontend-Grundlayout)

**Beschreibung**
- Basislayout mit:
  - Sidebar (Navigation)
  - Header/Topbar
  - Content-Bereich
  - Routing (Login, Library, Game-Details, Einstellungen, Wishlists).

**Akzeptanzkriterien**
- Navigierbare App mit Mock-Daten.
- Responsives Layout für verschiedene Fenstergrößen.
- Dunkles Default-Theme.

---

### TICKET-033 – Library-Frontend (Liste, Suche, Filter)

**Beschreibung**
- Library-View:
  - Grid/List der Games
  - Sucheingabe
  - Filter (Installiert, Stores, Tags)

**Akzeptanzkriterien**
- Library wird per API geladen.
- Filter & Suche wirken ohne Reload.
- Versteckte Spiele erscheinen nur mit speziellem Toggle.

---

### TICKET-034 – Game-Detail-Frontend + Preisvergleich

**Beschreibung**
- Detailansicht mit:
  - Cover, Beschreibung, Metadaten
  - Launch/Add to Wishlist Buttons
  - Preisvergleichs-Sektion (Stores, Preise, Discounts).

**Akzeptanzkriterien**
- Klick auf Spiel in Library öffnet Detailseite.
- Preise werden aus API geladen, Fallback bei Fehlen.
- Launch-Button triggert korrekten Backend-Call.

---

### TICKET-035 – Wishlist-Frontend

**Beschreibung**
- Ansicht für:
  - Liste aller Wishlists
  - Einzel-Wishlist mit Spielen
  - Hinzufügen/Entfernen von Spielen
  - Preisalarm-Indikator.

**Akzeptanzkriterien**
- Wishlist-Operationen funktionieren End-to-End.
- Steam-Import ist über UI auslösbar.
- Preisalarme je Spiel konfigurierbar.

---

### TICKET-036 – Settings-Frontend

**Beschreibung**
- Bereich für:
  - Account/Profil
  - Store-Verknüpfungen
  - Scan-Pfade
  - Benachrichtigungs-Settings
  - UI-Theme.

**Akzeptanzkriterien**
- Store-Verknüpfung/Trennung ist aus UI möglich.
- Scan-Pfade können in einer Liste verwaltet werden.
- Theme-Wechsel (Dark/Light) funktioniert.

---

## PHASE 7 – Erweiterte Features (Optional/Später)

### TICKET-037 – Cloud Sync für Library-Metadaten

**Beschreibung**
- Sync von:
  - Hidden Games
  - Collections
  - Wishlists
  zwischen Geräten.

**Akzeptanzkriterien**
- User-spezifische Einstellungen werden serverseitig persistiert.
- Login auf anderem Gerät zeigt gleiche Library-Ansichten.

---

### TICKET-038 – Savegame-Backup – Konzept & Basis-Implementierung

**Beschreibung**
- Grundlegende Erkennung von Savegame-Verzeichnissen (konfigurierbar).
- Manuelles Backup/Restore (Cloud oder lokales Archiv).

**Akzeptanzkriterien**
- User kann pro Spiel Pfade definieren.
- Backup-Job erstellt Archiv mit Versionsangabe.
- Restore-Knopf spielt Version zurück.

---

### TICKET-039 – Crash- & Event-Logging

**Beschreibung**
- Zentralisiertes Error/Crash-Logging (Client + Server).
- Minimaler Event-Logger für kritische Aktionen.

**Akzeptanzkriterien**
- Fehler werden in Log-Dateien oder externem Dienst erfasst.
- Korrelations-ID pro Request/Session.

---

### TICKET-040 – Overlay-System – Research & PoC

**Beschreibung**
- Machbarkeitsstudie für In-Game-Overlay (Screenshots, Basics).
- PoC mit minimalem Overlay für 1 Spiel/Engine.

**Akzeptanzkriterien**
- Dokumentierte technische Möglichkeiten & Limitierungen.
- Einfacher Proof-of-Concept funktioniert in Test-Setup.

---

## PHASE X – Aufräumen & Qualität

### TICKET-041 – End-to-End Tests (kritische Flows)

**Beschreibung**
- Automatisierte Tests für:
  - Login/Logout
  - Store-Verknüpfung
  - Library-Laden
  - Spiel starten
  - Wishlist bearbeiten.

**Akzeptanzkriterien**
- CI-Job, der E2E-Tests ausführt.
- Dokumentation, wie Tests lokal gestartet werden.

---

### TICKET-042 – Performance-Optimierungen & Caching-Feintuning

**Beschreibung**
- Review von:
  - DB-Queries
  - API-Latenzen
  - Caching-Strategien.
- Hotspots identifizieren und optimieren.

**Akzeptanzkriterien**
- Messbare Verbesserung (z. B. Library-Ladezeit).
- Monitoring-Kennzahlen (einfacher Report oder Dashboard).

---
