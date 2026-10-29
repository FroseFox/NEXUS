import {
  MediaCategory,
  MediaProgressSummary,
  MediaWork,
  UserLibraryEntry,
  WatchStatus,
} from '../types/media';

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const VALID_CATEGORIES: MediaCategory[] = ['film', 'serie', 'anime'];
const VALID_STATUSES: WatchStatus[] = [
  'a_regarder',
  'en_cours',
  'termine',
  'en_pause',
  'abandonne',
];

export function formatEpisodeCode(seasonNumber: number, episodeNumber: number): string {
  return `S${seasonNumber}E${episodeNumber}`;
}

export function parseEpisodeCode(
  code: string
): { seasonNumber: number; episodeNumber: number } | null {
  const match = /^S(\d+)E(\d+)$/i.exec(code.trim());
  if (!match) return null;
  return {
    seasonNumber: Number(match[1]),
    episodeNumber: Number(match[2]),
  };
}

export function getTotalEpisodesForMedia(media: MediaWork): number {
  if (media.category === 'film' || !media.seasons || media.seasons.length === 0) {
    return 1;
  }
  return media.seasons.reduce((acc, s) => acc + s.episodes.length, 0);
}

/**
 * Calcule la progression exacte d'une œuvre (film, série ou anime) sans jamais confondre
 * deux saisons, deux épisodes ou deux versions d'un anime.
 */
export function calculateMediaProgress(
  media: MediaWork,
  entry?: UserLibraryEntry | null
): MediaProgressSummary {
  if (media.category === 'film' || !media.seasons || media.seasons.length === 0) {
    const isCompleted = entry?.status === 'termine';
    return {
      watchedCount: isCompleted ? 1 : 0,
      totalCount: 1,
      remainingCount: isCompleted ? 0 : 1,
      percentage: isCompleted ? 100 : 0,
      isCompleted,
      nextEpisodeToWatch: null,
      lastWatchedEpisodeCode: null,
      lastWatchedEpisodeTitle: null,
    };
  }

  const watchedSet = new Set(entry?.watchedEpisodes ?? []);
  const allEpisodes: {
    seasonNumber: number;
    episodeNumber: number;
    code: string;
    titleFr: string;
  }[] = [];

  const sortedSeasons = [...media.seasons].sort((a, b) => a.seasonNumber - b.seasonNumber);
  for (const season of sortedSeasons) {
    const sortedEps = [...season.episodes].sort((a, b) => a.episodeNumber - b.episodeNumber);
    for (const ep of sortedEps) {
      allEpisodes.push({
        seasonNumber: season.seasonNumber,
        episodeNumber: ep.episodeNumber,
        code: formatEpisodeCode(season.seasonNumber, ep.episodeNumber),
        titleFr: ep.titleFr,
      });
    }
  }

  const totalCount = allEpisodes.length;
  if (totalCount === 0) {
    return {
      watchedCount: 0,
      totalCount: 0,
      remainingCount: 0,
      percentage: 0,
      isCompleted: false,
      nextEpisodeToWatch: null,
      lastWatchedEpisodeCode: null,
      lastWatchedEpisodeTitle: null,
    };
  }

  let watchedCount = 0;
  let nextEpisodeToWatch: MediaProgressSummary['nextEpisodeToWatch'] = null;
  let highestWatched: (typeof allEpisodes)[number] | null = null;

  for (const ep of allEpisodes) {
    if (watchedSet.has(ep.code)) {
      watchedCount++;
      highestWatched = ep;
    } else if (!nextEpisodeToWatch) {
      nextEpisodeToWatch = ep;
    }
  }

  const remainingCount = Math.max(0, totalCount - watchedCount);
  const percentage = Math.round((watchedCount / totalCount) * 100);
  const isCompleted = watchedCount === totalCount && totalCount > 0;

  // Si lastWatchedEpisode est explicitement stocké et toujours vu, on le résout, sinon highestWatched
  let lastWatchedCode = highestWatched?.code ?? null;
  let lastWatchedTitle = highestWatched?.titleFr ?? null;
  if (entry?.lastWatchedEpisode && watchedSet.has(entry.lastWatchedEpisode)) {
    const found = allEpisodes.find((e) => e.code === entry.lastWatchedEpisode);
    if (found) {
      lastWatchedCode = found.code;
      lastWatchedTitle = found.titleFr;
    }
  }

  return {
    watchedCount,
    totalCount,
    remainingCount,
    percentage,
    isCompleted,
    nextEpisodeToWatch,
    lastWatchedEpisodeCode: lastWatchedCode,
    lastWatchedEpisodeTitle: lastWatchedTitle,
  };
}

export function createDefaultLibraryEntry(
  media: MediaWork,
  userId = 'local-user',
  initialStatus: WatchStatus = 'a_regarder'
): UserLibraryEntry {
  const now = new Date().toISOString();
  return {
    mediaId: media.id,
    userId,
    category: media.category,
    title: media.titleFr,
    posterUrl: media.posterUrl,
    status: initialStatus,
    isFavorite: false,
    inWatchlist: initialStatus === 'a_regarder',
    rewatchDates: [],
    watchedEpisodes: [],
    totalEpisodesCount: getTotalEpisodesForMedia(media),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Bascule le statut vu/non vu d'un épisode spécifique d'une série ou d'un anime
 * et recalcule automatiquement le statut global (en_cours, termine, a_regarder).
 */
export function toggleEpisodeWatched(
  media: MediaWork,
  existingEntry: UserLibraryEntry | undefined,
  seasonNumber: number,
  episodeNumber: number,
  userId = 'local-user'
): UserLibraryEntry {
  const base = existingEntry
    ? { ...existingEntry, watchedEpisodes: [...existingEntry.watchedEpisodes] }
    : createDefaultLibraryEntry(media, userId, 'en_cours');

  const code = formatEpisodeCode(seasonNumber, episodeNumber);
  const exists = base.watchedEpisodes.includes(code);

  let updatedEpisodes: string[];
  let lastWatched = base.lastWatchedEpisode;

  if (exists) {
    updatedEpisodes = base.watchedEpisodes.filter((c) => c !== code);
    if (lastWatched === code) {
      lastWatched = updatedEpisodes[updatedEpisodes.length - 1];
    }
  } else {
    updatedEpisodes = [...base.watchedEpisodes, code];
    lastWatched = code;
  }

  const totalEpisodes = getTotalEpisodesForMedia(media);
  let nextStatus: WatchStatus = base.status;

  if (updatedEpisodes.length === 0) {
    if (base.status === 'termine' || base.status === 'en_cours') {
      nextStatus = 'a_regarder';
    }
  } else if (updatedEpisodes.length >= totalEpisodes && totalEpisodes > 0) {
    nextStatus = 'termine';
  } else if (base.status === 'a_regarder' || base.status === 'termine') {
    nextStatus = 'en_cours';
  }

  return {
    ...base,
    status: nextStatus,
    inWatchlist: nextStatus === 'a_regarder' ? true : base.inWatchlist,
    watchedEpisodes: updatedEpisodes.slice(0, 500),
    lastWatchedEpisode: lastWatched,
    totalEpisodesCount: totalEpisodes,
    watchedDate:
      nextStatus === 'termine' && !base.watchedDate
        ? new Date().toISOString().slice(0, 10)
        : base.watchedDate,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Marque ou démarque l'intégralité d'une saison spécifique comme vue.
 */
export function markSeasonWatched(
  media: MediaWork,
  existingEntry: UserLibraryEntry | undefined,
  seasonNumber: number,
  markAsWatched: boolean,
  userId = 'local-user'
): UserLibraryEntry {
  const base = existingEntry
    ? { ...existingEntry, watchedEpisodes: [...existingEntry.watchedEpisodes] }
    : createDefaultLibraryEntry(media, userId, 'en_cours');

  const season = media.seasons?.find((s) => s.seasonNumber === seasonNumber);
  if (!season) return base;

  const seasonCodes = season.episodes.map((ep) =>
    formatEpisodeCode(seasonNumber, ep.episodeNumber)
  );
  const seasonCodeSet = new Set(seasonCodes);

  let updatedEpisodes: string[];
  let lastWatched = base.lastWatchedEpisode;

  if (markAsWatched) {
    const merged = new Set([...base.watchedEpisodes, ...seasonCodes]);
    updatedEpisodes = Array.from(merged);
    if (seasonCodes.length > 0) {
      lastWatched = seasonCodes[seasonCodes.length - 1];
    }
  } else {
    updatedEpisodes = base.watchedEpisodes.filter((code) => !seasonCodeSet.has(code));
    if (lastWatched && seasonCodeSet.has(lastWatched)) {
      lastWatched = updatedEpisodes[updatedEpisodes.length - 1];
    }
  }

  const totalEpisodes = getTotalEpisodesForMedia(media);
  let nextStatus: WatchStatus = base.status;
  if (updatedEpisodes.length === 0) {
    nextStatus = 'a_regarder';
  } else if (updatedEpisodes.length >= totalEpisodes && totalEpisodes > 0) {
    nextStatus = 'termine';
  } else {
    nextStatus = 'en_cours';
  }

  return {
    ...base,
    status: nextStatus,
    watchedEpisodes: updatedEpisodes.slice(0, 500),
    lastWatchedEpisode: lastWatched,
    totalEpisodesCount: totalEpisodes,
    watchedDate:
      nextStatus === 'termine' && !base.watchedDate
        ? new Date().toISOString().slice(0, 10)
        : base.watchedDate,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Recherche universelle dans un catalogue de films, séries et anime à partir du titre français,
 * du titre original (romaji/kanji/anglais) ou des titres alternatifs, avec filtres.
 */
export function searchAndFilterCatalog(
  catalog: MediaWork[],
  options: {
    query?: string;
    category?: MediaCategory | 'all';
    genre?: string | 'all';
    onlyAvailableOnPlatform?: string | 'all';
  }
): MediaWork[] {
  const q = (options.query ?? '').trim().toLowerCase();
  const category = options.category ?? 'all';
  const genre = options.genre ?? 'all';
  const platform = options.onlyAvailableOnPlatform ?? 'all';

  return catalog.filter((work) => {
    if (category !== 'all' && work.category !== category) {
      return false;
    }
    if (genre !== 'all' && !work.genres.some((g) => g.toLowerCase() === genre.toLowerCase())) {
      return false;
    }
    if (
      platform !== 'all' &&
      !work.availabilitiesFr.some((a) => a.platform.toLowerCase() === platform.toLowerCase())
    ) {
      return false;
    }
    if (!q) return true;

    const matchesFr = work.titleFr.toLowerCase().includes(q);
    const matchesOrig = work.titleOriginal.toLowerCase().includes(q);
    const matchesAlt = work.altTitles.some((alt) => alt.toLowerCase().includes(q));
    const matchesDirector = work.directorOrStudio.toLowerCase().includes(q);

    return matchesFr || matchesOrig || matchesAlt || matchesDirector;
  });
}

/**
 * Sanitise et garantit qu'une entrée de bibliothèque respecte strictement les limites
 * définies dans firebase-blueprint.json et firestore.rules.
 */
export function sanitizeLibraryPayload(
  entry: UserLibraryEntry,
  userId: string
): UserLibraryEntry {
  const safeMediaId = entry.mediaId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128) || 'unknown-id';
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128) || 'local-user';
  const safeCategory: MediaCategory = VALID_CATEGORIES.includes(entry.category)
    ? entry.category
    : 'film';
  const safeStatus: WatchStatus = VALID_STATUSES.includes(entry.status)
    ? entry.status
    : 'a_regarder';

  const safeTitle = (entry.title || 'Sans titre').trim().slice(0, 200);
  const safePoster = (entry.posterUrl || '').trim().slice(0, 500);
  const safeRating =
    typeof entry.personalRating === 'number' &&
    !Number.isNaN(entry.personalRating) &&
    entry.personalRating >= 0 &&
    entry.personalRating <= 10
      ? Math.round(entry.personalRating * 10) / 10
      : undefined;

  const safeWatchedDate = entry.watchedDate ? String(entry.watchedDate).slice(0, 32) : undefined;
  const safeRewatchDates = Array.isArray(entry.rewatchDates)
    ? entry.rewatchDates
        .filter((d): d is string => typeof d === 'string' && d.trim().length > 0)
        .map((d) => d.trim().slice(0, 32))
        .slice(0, 50)
    : [];

  const safeWatchedEpisodes = Array.isArray(entry.watchedEpisodes)
    ? entry.watchedEpisodes
        .filter((e): e is string => typeof e === 'string' && /^S\d+E\d+$/i.test(e.trim()))
        .map((e) => e.trim().toUpperCase().slice(0, 32))
        .slice(0, 500)
    : [];

  const safeLastEpisode = entry.lastWatchedEpisode
    ? String(entry.lastWatchedEpisode).slice(0, 32)
    : undefined;

  const safeTotalEpisodes =
    typeof entry.totalEpisodesCount === 'number' &&
    entry.totalEpisodesCount >= 0 &&
    entry.totalEpisodesCount <= 5000
      ? Math.floor(entry.totalEpisodesCount)
      : 1;

  return {
    mediaId: safeMediaId,
    userId: safeUserId,
    category: safeCategory,
    title: safeTitle,
    posterUrl: safePoster,
    status: safeStatus,
    isFavorite: Boolean(entry.isFavorite),
    inWatchlist: Boolean(entry.inWatchlist),
    personalRating: safeRating,
    watchedDate: safeWatchedDate,
    rewatchDates: safeRewatchDates,
    watchedEpisodes: safeWatchedEpisodes,
    lastWatchedEpisode: safeLastEpisode,
    totalEpisodesCount: safeTotalEpisodes,
    createdAt: entry.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Valide un payload brut selon les mêmes invariants que `isValidUserLibraryItem` dans `firestore.rules`.
 * Utile pour les tests de sécurité ("Dirty Dozen") et l'import JSON.
 */
export function validateFirestoreRuleInvariants(
  payload: Record<string, unknown>,
  context: {
    authUid: string | null;
    emailVerified: boolean;
    pathUserId: string;
    pathMediaId: string;
    operation: 'create' | 'update' | 'get' | 'list';
    existingDoc?: Record<string, unknown>;
    requestTimeIso: string;
  }
): { allowed: boolean; reason?: string } {
  if (!context.authUid) {
    return { allowed: false, reason: 'UNAUTHENTICATED' };
  }
  if (context.authUid !== context.pathUserId) {
    return { allowed: false, reason: 'CROSS_USER_ACCESS_DENIED' };
  }
  if (
    context.operation !== 'list' &&
    (!VALID_ID_REGEX.test(context.pathUserId) ||
      context.pathUserId.length > 128 ||
      !VALID_ID_REGEX.test(context.pathMediaId) ||
      context.pathMediaId.length > 128)
  ) {
    return { allowed: false, reason: 'INVALID_PATH_ID' };
  }

  if (context.operation === 'get' || context.operation === 'list') {
    if (!context.existingDoc || context.existingDoc.userId !== context.authUid) {
      return { allowed: false, reason: 'RESOURCE_OWNER_MISMATCH' };
    }
    return { allowed: true };
  }

  if (!context.emailVerified) {
    return { allowed: false, reason: 'EMAIL_NOT_VERIFIED' };
  }

  const requiredKeys = [
    'mediaId',
    'userId',
    'category',
    'title',
    'status',
    'isFavorite',
    'inWatchlist',
    'watchedEpisodes',
    'rewatchDates',
    'createdAt',
    'updatedAt',
  ];
  const allowedKeys = new Set([
    ...requiredKeys,
    'posterUrl',
    'personalRating',
    'watchedDate',
    'lastWatchedEpisode',
    'totalEpisodesCount',
  ]);

  const keys = Object.keys(payload);
  for (const req of requiredKeys) {
    if (!(req in payload)) {
      return { allowed: false, reason: `MISSING_REQUIRED_KEY_${req}` };
    }
  }
  for (const k of keys) {
    if (!allowedKeys.has(k)) {
      return { allowed: false, reason: `SHADOW_FIELD_REJECTED_${k}` };
    }
  }

  if (payload.userId !== context.authUid || payload.userId !== context.pathUserId) {
    return { allowed: false, reason: 'USER_ID_SPOOFING' };
  }
  if (
    typeof payload.mediaId !== 'string' ||
    payload.mediaId !== context.pathMediaId ||
    !VALID_ID_REGEX.test(payload.mediaId) ||
    payload.mediaId.length > 128
  ) {
    return { allowed: false, reason: 'INVALID_MEDIA_ID' };
  }

  if (!VALID_CATEGORIES.includes(payload.category as MediaCategory)) {
    return { allowed: false, reason: 'INVALID_CATEGORY' };
  }
  if (!VALID_STATUSES.includes(payload.status as WatchStatus)) {
    return { allowed: false, reason: 'INVALID_STATUS' };
  }
  if (
    typeof payload.title !== 'string' ||
    payload.title.length < 1 ||
    payload.title.length > 200
  ) {
    return { allowed: false, reason: 'INVALID_TITLE' };
  }
  if (typeof payload.isFavorite !== 'boolean' || typeof payload.inWatchlist !== 'boolean') {
    return { allowed: false, reason: 'INVALID_BOOLEAN_FLAGS' };
  }

  if (
    'personalRating' in payload &&
    payload.personalRating !== undefined &&
    (typeof payload.personalRating !== 'number' ||
      payload.personalRating < 0 ||
      payload.personalRating > 10)
  ) {
    return { allowed: false, reason: 'INVALID_PERSONAL_RATING' };
  }

  if (
    !Array.isArray(payload.watchedEpisodes) ||
    payload.watchedEpisodes.length > 500 ||
    (payload.watchedEpisodes.length > 0 &&
      (typeof payload.watchedEpisodes[0] !== 'string' || payload.watchedEpisodes[0].length > 32))
  ) {
    return { allowed: false, reason: 'INVALID_WATCHED_EPISODES_ARRAY' };
  }

  if (
    !Array.isArray(payload.rewatchDates) ||
    payload.rewatchDates.length > 50 ||
    (payload.rewatchDates.length > 0 &&
      (typeof payload.rewatchDates[0] !== 'string' || payload.rewatchDates[0].length > 32))
  ) {
    return { allowed: false, reason: 'INVALID_REWATCH_DATES_ARRAY' };
  }

  if (context.operation === 'create') {
    if (
      payload.createdAt !== context.requestTimeIso ||
      payload.updatedAt !== context.requestTimeIso
    ) {
      return { allowed: false, reason: 'FORGED_TIMESTAMP_ON_CREATE' };
    }
  }

  if (context.operation === 'update') {
    if (!context.existingDoc) {
      return { allowed: false, reason: 'MISSING_EXISTING_DOC' };
    }
    if (
      payload.userId !== context.existingDoc.userId ||
      payload.mediaId !== context.existingDoc.mediaId ||
      payload.category !== context.existingDoc.category ||
      payload.createdAt !== context.existingDoc.createdAt
    ) {
      return { allowed: false, reason: 'IMMUTABLE_FIELD_MODIFIED' };
    }
    if (payload.updatedAt !== context.requestTimeIso) {
      return { allowed: false, reason: 'FORGED_TIMESTAMP_ON_UPDATE' };
    }
  }

  return { allowed: true };
}

export function exportLibraryToJson(entries: Record<string, UserLibraryEntry>): string {
  const payload = {
    application: 'NEXUS',
    version: '1.0',
    exportedAt: new Date().toISOString(),
    itemCount: Object.keys(entries).length,
    items: Object.values(entries),
  };
  return JSON.stringify(payload, null, 2);
}

export function parseAndValidateLibraryImport(
  rawJson: string,
  userId = 'local-user'
): { entries: Record<string, UserLibraryEntry>; importedCount: number } {
  const parsed = JSON.parse(rawJson);
  const rawItems: unknown[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.items)
      ? parsed.items
      : [];

  if (rawItems.length === 0 && !Array.isArray(parsed) && !Array.isArray(parsed?.items)) {
    throw new Error('Format JSON invalide : tableau items introuvable.');
  }

  const result: Record<string, UserLibraryEntry> = {};
  for (const item of rawItems) {
    if (item && typeof item === 'object' && 'mediaId' in item && 'title' in item) {
      const sanitized = sanitizeLibraryPayload(item as UserLibraryEntry, userId);
      result[sanitized.mediaId] = sanitized;
    }
  }
  return {
    entries: result,
    importedCount: Object.keys(result).length,
  };
}
