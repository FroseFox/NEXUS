import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateMediaProgress,
  toggleEpisodeWatched,
  markSeasonWatched,
  searchAndFilterCatalog,
  exportLibraryToJson,
  parseAndValidateLibraryImport,
  validateFirestoreRuleInvariants,
} from './trackingLogic';
import { MediaWork } from '../types/media';

const sampleAnime: MediaWork = {
  id: 'anime-frieren-s1',
  category: 'anime',
  titleFr: 'Frieren : Beyond Journey’s End',
  titleOriginal: 'Sousou no Frieren',
  altTitles: ['葬送のフリーレン', 'Frieren'],
  year: 2023,
  durationLabel: '1 saison · 4 épisodes',
  genres: ['Fantasy', 'Aventure', 'Drame'],
  directorOrStudio: 'Madhouse',
  castOrCreators: ['Keiichiro Saito'],
  publicRating: 9.3,
  synopsis: 'Après la défaite du Roi Démon, l’elfe Frieren entreprend un voyage pour comprendre les humains.',
  posterUrl: '/poster.jpg',
  backdropUrl: '/backdrop.jpg',
  ageRating: '12+',
  country: 'Japon',
  seasons: [
    {
      seasonNumber: 1,
      title: 'Saison 1 — Partie 1',
      year: 2023,
      episodes: [
        { episodeNumber: 1, titleFr: 'La fin de l’aventure', durationMinutes: 24, airDate: '2023-09-29' },
        { episodeNumber: 2, titleFr: 'Ce n’était pas de la magie', durationMinutes: 24, airDate: '2023-09-29' },
      ],
    },
    {
      seasonNumber: 2,
      title: 'Saison 2 — Examen des mages',
      year: 2024,
      episodes: [
        { episodeNumber: 1, titleFr: 'Les mages de première classe', durationMinutes: 24, airDate: '2024-01-05' },
        { episodeNumber: 2, titleFr: 'Le labyrinthe', durationMinutes: 24, airDate: '2024-01-12' },
      ],
    },
  ],
  availabilitiesFr: [
    {
      platform: 'Crunchyroll',
      offerType: 'abonnement',
      verifiedPrice: 'Inclus (Dès 5,99 €/mois)',
      officialUrl: 'https://www.crunchyroll.com/fr/series/GG5H5XQX4/frieren-beyond-journeys-end',
      verifiedDate: 'Octobre 2026',
    },
  ],
};

test('ouverture de fiche ne marque jamais une œuvre comme vue', () => {
  const progress = calculateMediaProgress(sampleAnime, undefined);
  assert.equal(progress.watchedCount, 0);
  assert.equal(progress.totalCount, 4);
  assert.equal(progress.remainingCount, 4);
  assert.equal(progress.percentage, 0);
  assert.equal(progress.isCompleted, false);
  assert.equal(progress.nextEpisodeToWatch?.code, 'S1E1');
});

test('suivi par saison et épisode ne confond jamais deux saisons (S1E1 vs S2E1)', () => {
  let entry = toggleEpisodeWatched(sampleAnime, undefined, 1, 1, 'user-1');
  assert.deepEqual(entry.watchedEpisodes, ['S1E1']);
  assert.equal(entry.status, 'en_cours');

  let progress = calculateMediaProgress(sampleAnime, entry);
  assert.equal(progress.watchedCount, 1);
  assert.equal(progress.remainingCount, 3);
  assert.equal(progress.percentage, 25);
  assert.equal(progress.nextEpisodeToWatch?.code, 'S1E2');

  // Marquer S2E1 sans avoir vu S1E2 : S1E2 reste le prochain épisode non vu
  entry = toggleEpisodeWatched(sampleAnime, entry, 2, 1, 'user-1');
  assert.deepEqual(entry.watchedEpisodes, ['S1E1', 'S2E1']);
  progress = calculateMediaProgress(sampleAnime, entry);
  assert.equal(progress.watchedCount, 2);
  assert.equal(progress.nextEpisodeToWatch?.code, 'S1E2');
  assert.equal(progress.lastWatchedEpisodeCode, 'S2E1');

  // Annuler le statut vu de S1E1
  entry = toggleEpisodeWatched(sampleAnime, entry, 1, 1, 'user-1');
  assert.deepEqual(entry.watchedEpisodes, ['S2E1']);
  progress = calculateMediaProgress(sampleAnime, entry);
  assert.equal(progress.watchedCount, 1);
  assert.equal(progress.nextEpisodeToWatch?.code, 'S1E1');
});

test('marquer toute une saison comme terminée met à jour la progression et le statut final', () => {
  let entry = markSeasonWatched(sampleAnime, undefined, 1, true, 'user-1');
  assert.deepEqual(entry.watchedEpisodes, ['S1E1', 'S1E2']);
  assert.equal(entry.status, 'en_cours');

  entry = markSeasonWatched(sampleAnime, entry, 2, true, 'user-1');
  assert.equal(entry.watchedEpisodes.length, 4);
  assert.equal(entry.status, 'termine');

  const progress = calculateMediaProgress(sampleAnime, entry);
  assert.equal(progress.percentage, 100);
  assert.equal(progress.isCompleted, true);
  assert.equal(progress.nextEpisodeToWatch, null);
});

test('recherche universelle retrouve par titre français, titre original ou alternatif', () => {
  const catalog = [sampleAnime];
  assert.equal(searchAndFilterCatalog(catalog, { query: 'Frieren' }).length, 1);
  assert.equal(searchAndFilterCatalog(catalog, { query: 'Sousou no' }).length, 1);
  assert.equal(searchAndFilterCatalog(catalog, { query: '葬送のフリーレン' }).length, 1);
  assert.equal(searchAndFilterCatalog(catalog, { query: 'Inexistant' }).length, 0);
});

test('export et import JSON préservent intégralement la bibliothèque personnelle', () => {
  const entry = markSeasonWatched(sampleAnime, undefined, 1, true, 'user-42');
  const json = exportLibraryToJson({ [entry.mediaId]: entry });
  const imported = parseAndValidateLibraryImport(json, 'user-42');
  assert.equal(imported.importedCount, 1);
  assert.deepEqual(imported.entries['anime-frieren-s1'].watchedEpisodes, ['S1E1', 'S1E2']);
});

test('Dirty Dozen Payloads (Firestore Rules Invariants) bloquent les 12 vecteurs d’attaque', () => {
  const now = '2026-10-28T20:00:00.000Z';
  const validPayload = {
    mediaId: 'anime-frieren-s1',
    userId: 'user-1',
    category: 'anime',
    title: 'Frieren',
    status: 'en_cours',
    isFavorite: true,
    inWatchlist: true,
    watchedEpisodes: ['S1E1'],
    rewatchDates: [],
    createdAt: now,
    updatedAt: now,
  };

  // Cas valide
  assert.equal(
    validateFirestoreRuleInvariants(validPayload, {
      authUid: 'user-1',
      emailVerified: true,
      pathUserId: 'user-1',
      pathMediaId: 'anime-frieren-s1',
      operation: 'create',
      requestTimeIso: now,
    }).allowed,
    true
  );

  // 1. Spoofing d'identité
  assert.equal(
    validateFirestoreRuleInvariants(
      { ...validPayload, userId: 'victim-uid' },
      {
        authUid: 'user-1',
        emailVerified: true,
        pathUserId: 'user-1',
        pathMediaId: 'anime-frieren-s1',
        operation: 'create',
        requestTimeIso: now,
      }
    ).allowed,
    false
  );

  // 2. Shadow Field
  assert.equal(
    validateFirestoreRuleInvariants(
      { ...validPayload, isAdmin: true },
      {
        authUid: 'user-1',
        emailVerified: true,
        pathUserId: 'user-1',
        pathMediaId: 'anime-frieren-s1',
        operation: 'create',
        requestTimeIso: now,
      }
    ).allowed,
    false
  );

  // 3. Email non vérifié
  assert.equal(
    validateFirestoreRuleInvariants(validPayload, {
      authUid: 'user-1',
      emailVerified: false,
      pathUserId: 'user-1',
      pathMediaId: 'anime-frieren-s1',
      operation: 'create',
      requestTimeIso: now,
    }).allowed,
    false
  );

  // 4. ID Poisoning (>128 chars)
  const hugeId = 'a'.repeat(300);
  assert.equal(
    validateFirestoreRuleInvariants(
      { ...validPayload, mediaId: hugeId },
      {
        authUid: 'user-1',
        emailVerified: true,
        pathUserId: 'user-1',
        pathMediaId: hugeId,
        operation: 'create',
        requestTimeIso: now,
      }
    ).allowed,
    false
  );

  // 5. Catégorie hors périmètre (manga)
  assert.equal(
    validateFirestoreRuleInvariants(
      { ...validPayload, category: 'manga' },
      {
        authUid: 'user-1',
        emailVerified: true,
        pathUserId: 'user-1',
        pathMediaId: 'anime-frieren-s1',
        operation: 'create',
        requestTimeIso: now,
      }
    ).allowed,
    false
  );

  // 6. Statut invalide
  assert.equal(
    validateFirestoreRuleInvariants(
      { ...validPayload, status: 'hacked' },
      {
        authUid: 'user-1',
        emailVerified: true,
        pathUserId: 'user-1',
        pathMediaId: 'anime-frieren-s1',
        operation: 'create',
        requestTimeIso: now,
      }
    ).allowed,
    false
  );

  // 7. Dépassement de tableau (>500 épisodes)
  assert.equal(
    validateFirestoreRuleInvariants(
      { ...validPayload, watchedEpisodes: Array.from({ length: 501 }, (_, i) => `S1E${i}`) },
      {
        authUid: 'user-1',
        emailVerified: true,
        pathUserId: 'user-1',
        pathMediaId: 'anime-frieren-s1',
        operation: 'create',
        requestTimeIso: now,
      }
    ).allowed,
    false
  );

  // 8. Type d'élément de tableau invalide
  assert.equal(
    validateFirestoreRuleInvariants(
      { ...validPayload, watchedEpisodes: [999] },
      {
        authUid: 'user-1',
        emailVerified: true,
        pathUserId: 'user-1',
        pathMediaId: 'anime-frieren-s1',
        operation: 'create',
        requestTimeIso: now,
      }
    ).allowed,
    false
  );

  // 9. Modification d'un champ immuable (createdAt sur update)
  assert.equal(
    validateFirestoreRuleInvariants(
      { ...validPayload, createdAt: '2099-01-01T00:00:00.000Z' },
      {
        authUid: 'user-1',
        emailVerified: true,
        pathUserId: 'user-1',
        pathMediaId: 'anime-frieren-s1',
        operation: 'update',
        existingDoc: validPayload,
        requestTimeIso: now,
      }
    ).allowed,
    false
  );

  // 10. Horodatage forgé
  assert.equal(
    validateFirestoreRuleInvariants(
      { ...validPayload, updatedAt: '1999-01-01T00:00:00.000Z' },
      {
        authUid: 'user-1',
        emailVerified: true,
        pathUserId: 'user-1',
        pathMediaId: 'anime-frieren-s1',
        operation: 'create',
        requestTimeIso: now,
      }
    ).allowed,
    false
  );

  // 11. Note personnelle hors bornes
  assert.equal(
    validateFirestoreRuleInvariants(
      { ...validPayload, personalRating: 15 },
      {
        authUid: 'user-1',
        emailVerified: true,
        pathUserId: 'user-1',
        pathMediaId: 'anime-frieren-s1',
        operation: 'create',
        requestTimeIso: now,
      }
    ).allowed,
    false
  );

  // 12. Lecture/Liste croisée entre utilisateurs
  assert.equal(
    validateFirestoreRuleInvariants(validPayload, {
      authUid: 'attacker-uid',
      emailVerified: true,
      pathUserId: 'user-1',
      pathMediaId: 'anime-frieren-s1',
      operation: 'list',
      existingDoc: validPayload,
      requestTimeIso: now,
    }).allowed,
    false
  );
});
