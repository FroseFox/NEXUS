# NEXUS — Mon Centre Personnel pour Films, Séries et Anime

NEXUS est une application web moderne, sombre et cinématographique dédiée **exclusivement aux films, aux séries et aux anime japonais**. Elle fonctionne **sans aucune clé API privée à configurer** et est prête à être publiée gratuitement sur **GitHub Pages**.

---

## 1. Zéro Clé API Requise (Catalogues en Direct)

Vous n'avez besoin d'**aucune clé `VITE_TMDB_API_KEY`** ni d'aucun compte développeur payant :

| Domaine | API Publique Utilisée | Clé requise ? | Données récupérées en direct |
| :--- | :--- | :--- | :--- |
| **Films (France)** | **Apple TV / iTunes France Search API** (`https://itunes.apple.com/search?country=FR&lang=fr_fr`) | **Aucune (0 clé)** | Titres français, réalisateurs, années, durées, synopsis FR, affiches HD (`600x900`), tarifs vérifiés Location/Achat en France et liens directs Apple TV / Canal+ / Prime Video. |
| **Séries TV** | **TVMaze Public API** (`https://api.tvmaze.com`) | **Aucune (0 clé)** | Recherche internationale de séries et chargement automatique de toutes les vraies saisons et épisodes (`/shows/{id}/episodes`). |
| **Anime japonais** | **AniList GraphQL API** (`https://graphql.anilist.co`) | **Aucune (0 clé)** | Recherche d'anime (Séries TV, Films d'animation, OAV), titres Romaji/Anglais/Kanji, studios, nombres d'épisodes et liens officiels Crunchyroll / Netflix / ADN. |
| **Comptes & Cloud** | **Firebase Auth & Cloud Firestore** | Déjà configurée (`firebase-applet-config.json`) | Connexion Google en un clic et synchronisation multi-appareils + sauvegarde locale (`localStorage`) + Export/Import JSON. |

---

## 2. Comment publier NEXUS sur GitHub Pages (Étape par étape)

Le projet contient déjà :
- `vite.config.ts` configuré avec `base: './'` (pour que tous les fichiers CSS/JS et images fonctionnent quelle que soit l'adresse `https://votre-pseudo.github.io/nom-du-repo/`).
- `.github/workflows/deploy.yml` qui compile et déploie automatiquement votre site sur GitHub Pages à chaque modification.

### Méthode A — Depuis Google AI Studio (Le plus simple)
1. Cliquez sur l'icône **GitHub** (ou **Exporter / Télécharger ZIP**) en haut de l'interface Google AI Studio pour envoyer le code vers un nouveau dépôt sur votre compte GitHub (ex: `nexus`).
2. Sur votre dépôt GitHub, cliquez sur l'onglet **Settings** (Paramètres) en haut.
3. Dans le menu de gauche, cliquez sur **Pages**.
4. Dans la section **Build and deployment** -> **Source**, remplacez *Deploy from a branch* par **GitHub Actions**.
5. C'est tout ! L'action GitHub **« Déploiement NEXUS sur GitHub Pages »** se lance automatiquement et publie votre site en ~1 minute à l'adresse :
   `https://<votre-pseudo-github>.github.io/<nom-du-depot>/`

### Méthode B — Depuis votre ordinateur en ligne de commande
```bash
# 1. Initialiser Git et pousser vers votre dépôt GitHub
git init
git add .
git commit -m "Initial commit - NEXUS"
git branch -M main
git remote add origin https://github.com/<VOTRE_PSEUDO>/<NOM_DU_DEPOT>.git
git push -u origin main
```
Puis activez **Settings → Pages → Source : GitHub Actions** sur GitHub.

### Important : Autoriser votre domaine GitHub Pages pour la connexion Google (Firebase)
Si vous utilisez le bouton **« Se connecter avec Google »** sur votre site GitHub Pages :
1. Ouvrez la [Console Firebase](https://console.firebase.google.com/project/charged-unison-871nt/authentication/settings).
2. Allez dans **Authentication → Settings → Authorized domains (Domaines autorisés)**.
3. Cliquez sur **Add domain** et ajoutez `<votre-pseudo-github>.github.io`.
*(Même sans connexion Google, toute votre bibliothèque et votre progression d'épisodes sont enregistrées dans votre navigateur et exportables/importables en JSON).*

---

## 3. Lancement en Local (Développement)

```bash
npm install
npm run dev
```
Ouvrez `http://localhost:3000`.
