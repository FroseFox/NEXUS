# Spécification de Sécurité Firestore — NEXUS (`security_spec.md`)

## 1. Invariants de Données (Data Invariants)
1. **Isolation stricte par utilisateur (PII & Données personnelles)** : Chaque document dans `/users/{userId}/library/{mediaId}` appartient exclusivement à `userId`. Aucun utilisateur authentifié ou anonyme ne peut lire, lister, créer, modifier ou supprimer la bibliothèque d'un autre utilisateur (`request.auth.uid == userId && data.userId == request.auth.uid`).
2. **Vérification d'identité et d'e-mail** : Toutes les écritures exigent `request.auth != null && request.auth.token.email_verified == true`.
3. **Validation stricte des identifiants de chemin** : `userId` et `mediaId` doivent respecter `^[a-zA-Z0-9_\-]+$` avec une taille maximale de 128 caractères (`isValidId`).
4. **Intégrité temporelle et immuabilité** : `createdAt == request.time` à la création, `updatedAt == request.time` à la création et à la mise à jour. `createdAt`, `userId`, `mediaId` et `category` sont immuables lors d'un `update`.
5. **Bornes volumétriques (Anti-Denial of Wallet)** :
   - `watchedEpisodes` est une liste bornée à `<= 500` éléments.
   - `rewatchDates` est une liste bornée à `<= 50` éléments.
   - Toutes les chaînes (`title`, `posterUrl`, `watchedDate`, `lastWatchedEpisode`) possèdent une limite stricte `.size()`.
6. **Protection Anti-Shadow-Update** : `hasAll` et `hasOnly` empêchent l'injection de champs fantômes (ex: `isAdmin: true`).

## 2. Les 12 Charges Utiles Malveillantes ("Dirty Dozen" Payloads)
1. **Spoofing d'identité (`userId` différent de `auth.uid`)** : `{ userId: "victim_uid", mediaId: "film-dune-2", ... }` -> `PERMISSION_DENIED`
2. **Champ fantôme (Shadow Update)** : `{ ..., isVerifiedAdmin: true }` -> `PERMISSION_DENIED`
3. **Email non vérifié (`email_verified == false`)** : Tentative d'écriture avec un jeton non vérifié -> `PERMISSION_DENIED`
4. **ID Poisoning (Identifiant de 2 Ko ou caractères spéciaux)** : `mediaId = "a".repeat(2000)` -> `PERMISSION_DENIED`
5. **Catégorie hors périmètre (ex: `manga` ou `jeu_video`)** : `{ category: "manga", ... }` -> `PERMISSION_DENIED`
6. **Statut invalide** : `{ status: "pirated", ... }` -> `PERMISSION_DENIED`
7. **Dépassement de tableau (`watchedEpisodes` > 500 éléments)** : Liste de 501 épisodes -> `PERMISSION_DENIED`
8. **Type d'élément de tableau invalide (`watchedEpisodes: [123]`)** : Premier élément numérique au lieu de `string` -> `PERMISSION_DENIED`
9. **Modification d'un champ immuable (`createdAt` ou `userId` modifié lors d'un `update`)** -> `PERMISSION_DENIED`
10. **Horodatage forgé par le client (`updatedAt != request.time`)** -> `PERMISSION_DENIED`
11. **Note personnelle hors bornes (`personalRating: 99`)** -> `PERMISSION_DENIED`
12. **Lecture/Liste croisée entre utilisateurs (`list` sur `/users/other_uid/library`)** -> `PERMISSION_DENIED`
