import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Play,
  Plus,
  BookmarkCheck,
  Info,
  SlidersHorizontal,
  UserCheck,
  Download,
  Sparkles,
  Check,
  Film,
  Tv,
  Compass,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  DEFAULT_SEED_LIBRARY,
  GENERATED_ASSETS,
  INITIAL_CATALOG,
} from './data/catalog';
import {
  MediaCategory,
  MediaWork,
  UserLibraryEntry,
  WatchStatus,
} from './types/media';
import {
  calculateMediaProgress,
  createDefaultLibraryEntry,
  markSeasonWatched,
  searchAndFilterCatalog,
  toggleEpisodeWatched,
} from './utils/trackingLogic';
import {
  getConfiguredTmdbKey,
  searchAniListAnime,
  searchTmdbMulti,
  searchTvMazeSeries,
} from './services/mediaApi';
import {
  deleteLibraryEntryFromCloud,
  saveLibraryEntryToCloud,
  signInWithGoogle,
  signOutUser,
  subscribeToAuthChanges,
  subscribeToUserLibrary,
  testFirestoreConnection,
} from './services/firebase';
import { MediaRowSection } from './components/MediaRowSection';
import { MediaPosterCard } from './components/MediaPosterCard';
import { MediaDetailModal } from './components/MediaDetailModal';
import { AccountSyncModal } from './components/AccountSyncModal';

type NavTab = 'accueil' | 'films' | 'series' | 'anime' | 'bibliotheque';

const LOCAL_LIBRARY_STORAGE_KEY = 'nexus_personal_library_v1';
const LOCAL_EXTRA_CATALOG_KEY = 'nexus_discovered_catalog_v1';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('accueil');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [animeFormatFilter, setAnimeFormatFilter] = useState<'all' | 'tv' | 'movie'>('all');

  // Filtres spécifiques à Ma bibliothèque
  const [libCategoryFilter, setLibCategoryFilter] = useState<MediaCategory | 'all'>('all');
  const [libStatusFilter, setLibStatusFilter] = useState<WatchStatus | 'all' | 'favoris'>('all');

  // Catalogue local + œuvres découvertes via les API (AniList / TVMaze / TMDB)
  const [discoveredWorks, setDiscoveredWorks] = useState<MediaWork[]>(() => {
    try {
      const saved = window.localStorage.getItem(LOCAL_EXTRA_CATALOG_KEY);
      return saved ? (JSON.parse(saved) as MediaWork[]) : [];
    } catch {
      return [];
    }
  });

  // Bibliothèque personnelle persistante
  const [libraryMap, setLibraryMap] = useState<Record<string, UserLibraryEntry>>(() => {
    try {
      const saved = window.localStorage.getItem(LOCAL_LIBRARY_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved) as Record<string, UserLibraryEntry>;
      }
    } catch {
      // fallback to seed
    }
    return DEFAULT_SEED_LIBRARY;
  });

  // Authentification & synchronisation Firebase
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [cloudSyncState, setCloudSyncState] = useState<'local' | 'synced' | 'syncing' | 'error'>(
    'local'
  );
  const [cloudKnownIds, setCloudKnownIds] = useState<Set<string>>(new Set());

  // Résultats de recherche API en direct (100% sans clé API)
  const [apiSearchResults, setApiSearchResults] = useState<MediaWork[]>([]);
  const [isSearchingApi, setIsSearchingApi] = useState<boolean>(false);

  // Modales
  const [activeModalMedia, setActiveModalMedia] = useState<{
    media: MediaWork;
    openPlayer: boolean;
  } | null>(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState<boolean>(false);

  // Sélection de l'œuvre mise en avant dans la bannière d'accueil
  const [heroSpotlightId, setHeroSpotlightId] = useState<string>('film-dune-deuxieme-partie');

  // Test de connexion Firestore au démarrage
  useEffect(() => {
    testFirestoreConnection();
  }, []);

  // Sauvegarde automatique dans localStorage à chaque changement
  useEffect(() => {
    try {
      window.localStorage.setItem(LOCAL_LIBRARY_STORAGE_KEY, JSON.stringify(libraryMap));
    } catch (e) {
      console.error('Failed to persist library locally:', e);
    }
  }, [libraryMap]);

  useEffect(() => {
    try {
      window.localStorage.setItem(LOCAL_EXTRA_CATALOG_KEY, JSON.stringify(discoveredWorks));
    } catch {
      // ignore storage quota
    }
  }, [discoveredWorks]);

  // Abonnement Auth & Firestore
  useEffect(() => {
    let unsubscribeLibrary: (() => void) | null = null;

    const unsubscribeAuth = subscribeToAuthChanges((user) => {
      setCurrentUser(user);
      if (unsubscribeLibrary) {
        unsubscribeLibrary();
        unsubscribeLibrary = null;
      }

      if (user) {
        setCloudSyncState('syncing');
        unsubscribeLibrary = subscribeToUserLibrary(user.uid, (cloudEntries) => {
          setCloudKnownIds(new Set(Object.keys(cloudEntries)));
          setLibraryMap((prev) => {
            const merged = { ...prev, ...cloudEntries };
            return merged;
          });
          setCloudSyncState('synced');
        });
      } else {
        setCloudSyncState('local');
        setCloudKnownIds(new Set());
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeLibrary) unsubscribeLibrary();
    };
  }, []);

  // Catalogue unifié (initial + œuvres découvertes via API)
  const fullCatalog = useMemo(() => {
    const map = new Map<string, MediaWork>();
    for (const item of INITIAL_CATALOG) {
      map.set(item.id, item);
    }
    for (const item of discoveredWorks) {
      if (!map.has(item.id)) {
        map.set(item.id, item);
      }
    }
    for (const item of apiSearchResults) {
      if (!map.has(item.id)) {
        map.set(item.id, item);
      }
    }
    return Array.from(map.values());
  }, [discoveredWorks, apiSearchResults]);

  // Recherche en direct sans clé sur Apple TV FR (Films), TVMaze (Séries) et AniList GraphQL (Anime)
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setApiSearchResults([]);
      setIsSearchingApi(false);
      return;
    }

    let cancelled = false;
    setIsSearchingApi(true);

    const timer = window.setTimeout(async () => {
      try {
        const [moviesFrRes, anilistRes, tvmazeRes] = await Promise.all([
          activeTab === 'series' || activeTab === 'anime'
            ? Promise.resolve([])
            : searchFrenchMoviesNoKey(q),
          activeTab === 'films' || activeTab === 'series'
            ? Promise.resolve([])
            : searchAniListAnime(q),
          activeTab === 'films' || activeTab === 'anime'
            ? Promise.resolve([])
            : searchTvMazeSeries(q),
        ]);

        if (cancelled) return;
        const combined = [...moviesFrRes, ...anilistRes, ...tvmazeRes];
        setApiSearchResults(combined);
      } finally {
        if (!cancelled) setIsSearchingApi(false);
      }
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery, activeTab]);

  // Ouvre la fiche d'une œuvre et charge les vrais épisodes TVMaze si nécessaire
  const handleOpenDetailModal = async (media: MediaWork, openPlayer = false) => {
    setActiveModalMedia({ media, openPlayer });
    if (media.externalSource === 'tvmaze' && media.externalId) {
      const realSeasons = await fetchTvMazeEpisodes(media.externalId);
      if (realSeasons && realSeasons.length > 0) {
        const totalEps = realSeasons.reduce((acc, s) => acc + s.episodes.length, 0);
        const enriched: MediaWork = {
          ...media,
          seasons: realSeasons,
          durationLabel: `${realSeasons.length} saison${realSeasons.length > 1 ? 's' : ''} · ${totalEps} épisodes`,
        };
        setDiscoveredWorks((prev) => {
          const filtered = prev.filter((w) => w.id !== enriched.id);
          return [...filtered, enriched];
        });
        setActiveModalMedia((current) =>
          current && current.media.id === enriched.id
            ? { media: enriched, openPlayer: current.openPlayer }
            : current
        );
      }
    }
  };

  // Synchronisation d'une entrée modifiée vers LocalStorage + Firestore
  const persistEntryChange = async (media: MediaWork, updatedEntry: UserLibraryEntry) => {
    // Si l'œuvre provient d'une API externe, on la conserve dans discoveredWorks
    if (media.externalSource && media.externalSource !== 'curated') {
      setDiscoveredWorks((prev) =>
        prev.some((w) => w.id === media.id) ? prev : [...prev, media]
      );
    }

    setLibraryMap((prev) => ({
      ...prev,
      [media.id]: updatedEntry,
    }));

    if (currentUser) {
      setCloudSyncState('syncing');
      try {
        await saveLibraryEntryToCloud(
          currentUser.uid,
          updatedEntry,
          cloudKnownIds.has(media.id)
        );
        setCloudKnownIds((prev) => new Set(prev).add(media.id));
        setCloudSyncState('synced');
      } catch {
        setCloudSyncState('error');
      }
    }
  };

  const handleToggleWatchlist = (media: MediaWork) => {
    const existing = libraryMap[media.id];
    const uid = currentUser?.uid || 'local-user';
    const nextEntry: UserLibraryEntry = existing
      ? {
          ...existing,
          inWatchlist: !existing.inWatchlist,
          updatedAt: new Date().toISOString(),
        }
      : {
          ...createDefaultLibraryEntry(media, uid, 'a_regarder'),
          inWatchlist: true,
        };
    persistEntryChange(media, nextEntry);
  };

  const handleToggleFavorite = (media: MediaWork) => {
    const existing = libraryMap[media.id];
    const uid = currentUser?.uid || 'local-user';
    const nextEntry: UserLibraryEntry = existing
      ? {
          ...existing,
          isFavorite: !existing.isFavorite,
          updatedAt: new Date().toISOString(),
        }
      : {
          ...createDefaultLibraryEntry(media, uid, 'a_regarder'),
          isFavorite: true,
        };
    persistEntryChange(media, nextEntry);
  };

  const handleUpdateStatus = (media: MediaWork, status: WatchStatus) => {
    const existing = libraryMap[media.id];
    const uid = currentUser?.uid || 'local-user';
    const base = existing || createDefaultLibraryEntry(media, uid, status);
    const nextEntry: UserLibraryEntry = {
      ...base,
      status,
      inWatchlist: status === 'a_regarder' ? true : base.inWatchlist,
      watchedDate:
        status === 'termine' && !base.watchedDate
          ? new Date().toISOString().slice(0, 10)
          : base.watchedDate,
      updatedAt: new Date().toISOString(),
    };
    persistEntryChange(media, nextEntry);
  };

  const handleUpdateRating = (media: MediaWork, rating: number | undefined) => {
    const existing = libraryMap[media.id];
    const uid = currentUser?.uid || 'local-user';
    const base = existing || createDefaultLibraryEntry(media, uid, 'termine');
    const nextEntry: UserLibraryEntry = {
      ...base,
      personalRating: rating,
      updatedAt: new Date().toISOString(),
    };
    persistEntryChange(media, nextEntry);
  };

  const handleUpdateWatchedDate = (media: MediaWork, date: string) => {
    const existing = libraryMap[media.id];
    const uid = currentUser?.uid || 'local-user';
    const base = existing || createDefaultLibraryEntry(media, uid, 'termine');
    const nextEntry: UserLibraryEntry = {
      ...base,
      watchedDate: date || undefined,
      updatedAt: new Date().toISOString(),
    };
    persistEntryChange(media, nextEntry);
  };

  const handleAddRewatchDate = (media: MediaWork, date: string) => {
    const existing = libraryMap[media.id];
    const uid = currentUser?.uid || 'local-user';
    const base = existing || createDefaultLibraryEntry(media, uid, 'termine');
    const nextEntry: UserLibraryEntry = {
      ...base,
      rewatchDates: [...base.rewatchDates, date],
      updatedAt: new Date().toISOString(),
    };
    persistEntryChange(media, nextEntry);
  };

  const handleRemoveRewatchDate = (media: MediaWork, index: number) => {
    const existing = libraryMap[media.id];
    if (!existing) return;
    const nextEntry: UserLibraryEntry = {
      ...existing,
      rewatchDates: existing.rewatchDates.filter((_, i) => i !== index),
      updatedAt: new Date().toISOString(),
    };
    persistEntryChange(media, nextEntry);
  };

  const handleToggleEpisode = (
    media: MediaWork,
    seasonNumber: number,
    episodeNumber: number
  ) => {
    const existing = libraryMap[media.id];
    const uid = currentUser?.uid || 'local-user';
    const nextEntry = toggleEpisodeWatched(
      media,
      existing,
      seasonNumber,
      episodeNumber,
      uid
    );
    persistEntryChange(media, nextEntry);
  };

  const handleMarkSeason = (
    media: MediaWork,
    seasonNumber: number,
    watched: boolean
  ) => {
    const existing = libraryMap[media.id];
    const uid = currentUser?.uid || 'local-user';
    const nextEntry = markSeasonWatched(media, existing, seasonNumber, watched, uid);
    persistEntryChange(media, nextEntry);
  };

  const handleQuickMarkNextEpisode = (media: MediaWork) => {
    const existing = libraryMap[media.id];
    const progress = calculateMediaProgress(media, existing);
    if (!progress.nextEpisodeToWatch) return;
    handleToggleEpisode(
      media,
      progress.nextEpisodeToWatch.seasonNumber,
      progress.nextEpisodeToWatch.episodeNumber
    );
  };

  const handleRemoveFromLibrary = async (mediaId: string) => {
    setLibraryMap((prev) => {
      const copy = { ...prev };
      delete copy[mediaId];
      return copy;
    });
    if (currentUser && cloudKnownIds.has(mediaId)) {
      try {
        await deleteLibraryEntryFromCloud(currentUser.uid, mediaId);
      } catch {
        // handled in service
      }
    }
  };

  const handleImportLibrary = async (imported: Record<string, UserLibraryEntry>) => {
    setLibraryMap((prev) => ({
      ...prev,
      ...imported,
    }));
    if (currentUser) {
      for (const entry of Object.values(imported)) {
        await saveLibraryEntryToCloud(
          currentUser.uid,
          entry,
          cloudKnownIds.has(entry.mediaId)
        );
      }
    }
  };

  // Œuvre mise en avant dans le Hero
  const heroMedia = useMemo(
    () =>
      fullCatalog.find((m) => m.id === heroSpotlightId) ||
      INITIAL_CATALOG[0],
    [fullCatalog, heroSpotlightId]
  );

  const heroEntry = libraryMap[heroMedia.id];
  const heroProgress = calculateMediaProgress(heroMedia, heroEntry);

  // Rangées de la page d'accueil (Section 3)
  const continueWatchingItems = useMemo(
    () =>
      fullCatalog.filter((m) => {
        const e = libraryMap[m.id];
        return e && e.status === 'en_cours';
      }),
    [fullCatalog, libraryMap]
  );

  const watchlistItems = useMemo(
    () =>
      fullCatalog.filter((m) => {
        const e = libraryMap[m.id];
        return e && (e.inWatchlist || e.status === 'a_regarder');
      }),
    [fullCatalog, libraryMap]
  );

  const popularFilms = useMemo(
    () => fullCatalog.filter((m) => m.category === 'film' && m.isPopular),
    [fullCatalog]
  );

  const popularSeries = useMemo(
    () => fullCatalog.filter((m) => m.category === 'serie' && m.isPopular),
    [fullCatalog]
  );

  const popularAnime = useMemo(
    () => fullCatalog.filter((m) => m.category === 'anime' && m.isPopular),
    [fullCatalog]
  );

  const newReleases = useMemo(
    () => fullCatalog.filter((m) => m.isNewRelease),
    [fullCatalog]
  );

  const recommendedForMe = useMemo(
    () => fullCatalog.filter((m) => m.isRecommended),
    [fullCatalog]
  );

  // Genres disponibles pour les filtres
  const allGenres = useMemo(() => {
    const set = new Set<string>();
    INITIAL_CATALOG.forEach((w) => w.genres.forEach((g) => set.add(g)));
    return Array.from(set);
  }, []);

  // Filtrage pour les pages Catalogue / Recherche
  const filteredCatalogItems = useMemo(() => {
    const categoryConstraint: MediaCategory | 'all' =
      activeTab === 'films'
        ? 'film'
        : activeTab === 'series'
          ? 'serie'
          : activeTab === 'anime'
            ? 'anime'
            : 'all';

    let list = searchAndFilterCatalog(fullCatalog, {
      query: searchQuery,
      category: categoryConstraint,
      genre: selectedGenre,
      onlyAvailableOnPlatform: selectedPlatform,
    });

    if (activeTab === 'anime' && animeFormatFilter !== 'all') {
      list = list.filter((item) => {
        const isMovie =
          item.durationLabel.toLowerCase().includes('film') ||
          item.versionLabel?.toLowerCase().includes('film');
        return animeFormatFilter === 'movie' ? isMovie : !isMovie;
      });
    }

    return list;
  }, [
    fullCatalog,
    activeTab,
    searchQuery,
    selectedGenre,
    selectedPlatform,
    animeFormatFilter,
  ]);

  // Filtrage pour Ma bibliothèque
  const myLibraryWorks = useMemo(() => {
    const trackedWorks: MediaWork[] = [];
    for (const entry of Object.values(libraryMap)) {
      const existingWork = fullCatalog.find((w) => w.id === entry.mediaId);
      if (existingWork) {
        trackedWorks.push(existingWork);
      } else {
        // Reconstruit une fiche minimale si importée depuis un JSON externe
        trackedWorks.push({
          id: entry.mediaId,
          category: entry.category,
          titleFr: entry.title,
          titleOriginal: entry.title,
          altTitles: [],
          year: 2024,
          durationLabel: entry.category === 'film' ? 'Film suivi' : 'Série suivie',
          genres: ['Bibliothèque'],
          directorOrStudio: 'Suivi personnel',
          castOrCreators: [],
          publicRating: entry.personalRating || 8.0,
          synopsis: 'Œuvre importée dans votre bibliothèque personnelle NEXUS.',
          posterUrl: entry.posterUrl || GENERATED_ASSETS.posterFilmScifi,
          backdropUrl: GENERATED_ASSETS.heroCinemaBackdrop,
          ageRating: 'Tous publics',
          country: 'France',
          availabilitiesFr: [
            {
              platform: 'Canal+',
              offerType: 'abonnement',
              officialUrl: `https://www.canalplus.com/recherche?q=${encodeURIComponent(entry.title)}`,
              verifiedDate: 'Import',
            },
          ],
        });
      }
    }

    return trackedWorks.filter((work) => {
      const entry = libraryMap[work.id];
      if (!entry) return false;
      if (libCategoryFilter !== 'all' && work.category !== libCategoryFilter) {
        return false;
      }
      if (libStatusFilter === 'favoris' && !entry.isFavorite) {
        return false;
      }
      if (
        libStatusFilter !== 'all' &&
        libStatusFilter !== 'favoris' &&
        entry.status !== libStatusFilter
      ) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          work.titleFr.toLowerCase().includes(q) ||
          work.titleOriginal.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [libraryMap, fullCatalog, libCategoryFilter, libStatusFilter, searchQuery]);

  const isUniversalSearchActive = searchQuery.trim().length > 0 && activeTab === 'accueil';

  return (
    <div className="min-h-screen bg-[#06070a] text-[#f4f4f6] flex flex-col">
      {/* Top Bar Contract strict : 1 ligne, 3 zones séparées par gap-4 md:gap-8 */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-4 md:gap-8 px-4 sm:px-6 md:px-12 py-3.5 bg-[#06070a] border-b border-white/[0.08]">
        {/* Zone 1 : Brand title, single text element */}
        <a
          href="#accueil"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('accueil');
            setSearchQuery('');
            window.scrollTo({ top: 0, behavior: 'instant' });
          }}
          className="font-display text-lg sm:text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          NEXUS
        </a>

        {/* Zone 2 : 5 liens de navigation concis sur une seule ligne (scroll horizontal fluide sur mobile) */}
        <nav
          aria-label="Navigation principale"
          className="flex items-center gap-4 sm:gap-6 md:gap-7 text-xs sm:text-sm font-medium overflow-x-auto no-scrollbar"
        >
          {(
            [
              { id: 'accueil', label: 'Accueil' },
              { id: 'films', label: 'Films' },
              { id: 'series', label: 'Séries' },
              { id: 'anime', label: 'Anime' },
              { id: 'bibliotheque', label: 'Ma bibliothèque' },
            ] as { id: NavTab; label: string }[]
          ).map((nav) => {
            const active = activeTab === nav.id;
            return (
              <button
                key={nav.id}
                type="button"
                onClick={() => {
                  setActiveTab(nav.id);
                  window.scrollTo({ top: 0, behavior: 'instant' });
                }}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                  active
                    ? 'text-white border-[#e11d48] font-semibold'
                    : 'text-zinc-400 border-transparent hover:text-white'
                }`}
              >
                {nav.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3 : 1 action principale */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => setIsAccountModalOpen(true)}
            className="px-3 sm:px-4 py-2 text-xs font-semibold text-white bg-[#e11d48] hover:bg-[#be123c] rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            {currentUser ? 'Compte synchronisé' : 'Compte & Sauvegarde'}
          </button>
        </div>
      </header>

      {/* Barre d'outils secondaire : Recherche universelle */}
      <div className="border-b border-white/[0.06] bg-[#090b11] px-4 sm:px-6 md:px-12 py-2.5">
        <div className="mx-auto max-w-[1440px] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Barre de recherche universelle (Titre FR, VO, Romaji, Alternatif) */}
          <div className="relative flex-1 max-w-2xl">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un film, une série ou un anime (titre français, VO, romaji...)"
              aria-label="Rechercher une œuvre"
              className={`w-full rounded-xl bg-[#111420] border border-white/10 pl-10 ${
                searchQuery ? 'pr-20' : 'pr-4'
              } py-2 text-xs sm:text-sm text-white placeholder:text-zinc-400 focus:outline-none focus:border-white/30`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-300 hover:text-white"
              >
                Effacer
              </button>
            )}
          </div>

          {/* Indicateur sobre de suivi et d'accès rapide aux sauvegardes */}
          <div className="hidden lg:flex items-center gap-4 text-xs text-zinc-400 shrink-0">
            <span className="font-mono-tabular">
              {Object.keys(libraryMap).length} œuvres dans ma bibliothèque
            </span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setIsAccountModalOpen(true)}
              className="text-zinc-300 hover:text-white underline whitespace-nowrap"
            >
              Export / Import JSON & API
            </button>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <main className="flex-1 mx-auto w-full max-w-[1440px] px-4 sm:px-6 md:px-12 pb-20">
        {/* ================= PAGE ACCUEIL (hors recherche active) ================= */}
        {activeTab === 'accueil' && !isUniversalSearchActive && (
          <div className="space-y-3">
            {/* Grande bannière héroïque cinématographique calibrée pour le premier écran */}
            <section className="relative mt-4 rounded-2xl overflow-hidden bg-[#0e1018] border border-white/[0.08] min-h-[340px] md:min-h-[385px] flex items-end">
              <img
                src={heroMedia.backdropUrl}
                alt={`Bannière de ${heroMedia.titleFr}`}
                referrerPolicy="no-referrer"
                className="absolute inset-0 h-full w-full object-cover object-center"
              />
              {/* Scrim mesuré pour garantir le contraste WCAG AA */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#06070a] via-[#06070a]/75 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#06070a]/95 via-[#06070a]/55 to-transparent" />

              <div className="relative z-10 w-full p-6 sm:p-8 md:p-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <div className="max-w-2xl space-y-4">
                  {/* Métadonnées non encadrées avec séparateurs typographiques */}
                  <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-300">
                    <span className="text-[#e11d48] font-semibold">
                      {heroMedia.category === 'film'
                        ? 'Film à l’affiche'
                        : heroMedia.category === 'serie'
                          ? 'Série événement'
                          : 'Anime japonais'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-tabular">{heroMedia.year}</span>
                    <span aria-hidden="true">·</span>
                    <span>{heroMedia.durationLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span>{heroMedia.genres.join(' / ')}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-tabular text-amber-400">
                      ★ {heroMedia.publicRating.toFixed(1)}
                    </span>
                  </div>

                  <h1
                    className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-white leading-[1.08]"
                    style={{ textWrap: 'balance' }}
                  >
                    {heroMedia.titleFr}
                  </h1>

                  <p className="text-sm sm:text-base text-zinc-300 leading-relaxed line-clamp-3">
                    {heroMedia.synopsis}
                  </p>

                  <p className="text-xs text-zinc-400">
                    Disponible légalement en France sur :{' '}
                    <span className="text-zinc-200 font-medium">
                      {heroMedia.availabilitiesFr.map((a) => a.platform).join(' · ')}
                    </span>
                  </p>

                  {/* Boutons d'action de la bannière exigés par le brief */}
                  <div className="pt-2 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveModalMedia({ media: heroMedia, openPlayer: false })
                      }
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-[#06070a] hover:bg-zinc-200 text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
                    >
                      <Info className="h-4 w-4" />
                      <span>Ouvrir la fiche de l’œuvre</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleWatchlist(heroMedia)}
                      className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl border text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                        heroEntry?.inWatchlist
                          ? 'bg-[#e11d48] border-[#e11d48] text-white'
                          : 'bg-black/60 border-white/20 text-white hover:bg-white/10'
                      }`}
                    >
                      {heroEntry?.inWatchlist ? (
                        <>
                          <BookmarkCheck className="h-4 w-4" />
                          <span>Dans Ma liste</span>
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4" />
                          <span>Ajouter à ma liste</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setActiveModalMedia({ media: heroMedia, openPlayer: true })
                      }
                      className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-sm font-medium text-zinc-100 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Play className="h-4 w-4 fill-current" />
                      <span>
                        {heroMedia.category !== 'film' && heroProgress.nextEpisodeToWatch
                          ? `Reprendre ${heroProgress.nextEpisodeToWatch.code}`
                          : 'Regarder'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Sélecteur discret d'œuvres à la une */}
                <div className="flex items-center gap-2 self-start lg:self-end bg-black/65 border border-white/10 p-1.5 rounded-xl">
                  {[
                    { id: 'film-dune-deuxieme-partie', label: 'Dune : Deuxième Partie' },
                    { id: 'anime-frieren', label: 'Frieren' },
                    { id: 'serie-severance', label: 'Severance' },
                    { id: 'film-comte-monte-cristo-2024', label: 'Monte-Cristo' },
                  ].map((spot) => (
                    <button
                      key={spot.id}
                      type="button"
                      onClick={() => setHeroSpotlightId(spot.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        heroSpotlightId === spot.id
                          ? 'bg-white text-[#06070a] font-semibold'
                          : 'text-zinc-300 hover:text-white'
                      }`}
                    >
                      {spot.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* 1. Rangée « Reprendre le visionnage » */}
            <MediaRowSection
              title="Reprendre le visionnage"
              subtitle="Vos séries, films et anime en cours avec reprise directe au prochain épisode non vu"
              items={continueWatchingItems}
              libraryMap={libraryMap}
              variant="landscape"
              onOpenDetail={(media, autoOpenPlayer) =>
                setActiveModalMedia({ media, openPlayer: Boolean(autoOpenPlayer) })
              }
              onToggleWatchlist={handleToggleWatchlist}
              onQuickMarkNextEpisode={handleQuickMarkNextEpisode}
            />

            {/* 2. Rangée « Ma liste » */}
            <MediaRowSection
              title="Ma liste"
              subtitle="Les œuvres que vous avez mises de côté pour vos prochaines soirées"
              items={watchlistItems}
              libraryMap={libraryMap}
              onOpenDetail={(media, autoOpenPlayer) =>
                setActiveModalMedia({ media, openPlayer: Boolean(autoOpenPlayer) })
              }
              onToggleWatchlist={handleToggleWatchlist}
            />

            {/* 3. Rangée « Films populaires » */}
            <MediaRowSection
              title="Films populaires"
              subtitle="Longs-métrages incontournables disponibles sur Canal+, Netflix, Prime Video et Apple TV"
              items={popularFilms}
              libraryMap={libraryMap}
              onOpenDetail={(media, autoOpenPlayer) =>
                setActiveModalMedia({ media, openPlayer: Boolean(autoOpenPlayer) })
              }
              onToggleWatchlist={handleToggleWatchlist}
            />

            {/* 4. Rangée « Séries populaires » */}
            <MediaRowSection
              title="Séries populaires"
              subtitle="Créations originales et séries internationales avec suivi précis par saison et épisode"
              items={popularSeries}
              libraryMap={libraryMap}
              onOpenDetail={(media, autoOpenPlayer) =>
                setActiveModalMedia({ media, openPlayer: Boolean(autoOpenPlayer) })
              }
              onToggleWatchlist={handleToggleWatchlist}
            />

            {/* 5. Rangée « Anime populaires » */}
            <MediaRowSection
              title="Anime populaires"
              subtitle="Séries d’animation japonaise et films en simulcast sur Crunchyroll, ADN et Netflix"
              items={popularAnime}
              libraryMap={libraryMap}
              onOpenDetail={(media, autoOpenPlayer) =>
                setActiveModalMedia({ media, openPlayer: Boolean(autoOpenPlayer) })
              }
              onToggleWatchlist={handleToggleWatchlist}
            />

            {/* 6. Rangée « Nouveautés » */}
            <MediaRowSection
              title="Nouveautés"
              subtitle="Sorties récentes au cinéma, en SVOD et nouvelles saisons d’anime"
              items={newReleases}
              libraryMap={libraryMap}
              onOpenDetail={(media, autoOpenPlayer) =>
                setActiveModalMedia({ media, openPlayer: Boolean(autoOpenPlayer) })
              }
              onToggleWatchlist={handleToggleWatchlist}
            />

            {/* 7. Rangée « Recommandé pour moi » */}
            <MediaRowSection
              title="Recommandé pour moi"
              subtitle="Sélection éditoriale basée sur vos œuvres favorites et vos genres de prédilection"
              items={recommendedForMe}
              libraryMap={libraryMap}
              onOpenDetail={(media, autoOpenPlayer) =>
                setActiveModalMedia({ media, openPlayer: Boolean(autoOpenPlayer) })
              }
              onToggleWatchlist={handleToggleWatchlist}
            />
          </div>
        )}

        {/* ================= VUES CATALOGUES (FILMS / SÉRIES / ANIME) OU RECHERCHE UNIVERSELLE ================= */}
        {(activeTab === 'films' ||
          activeTab === 'series' ||
          activeTab === 'anime' ||
          isUniversalSearchActive) && (
          <section className="pt-8 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-white/[0.08] pb-5">
              <div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">
                  {isUniversalSearchActive
                    ? `Recherche universelle : « ${searchQuery} »`
                    : activeTab === 'films'
                      ? 'Catalogue Films'
                      : activeTab === 'series'
                        ? 'Catalogue Séries'
                        : 'Catalogue Anime Japonais'}
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                  {activeTab === 'anime'
                    ? 'Suivi distinct des saisons TV, films d’animation et OAV · Connecté en direct à l’API AniList GraphQL'
                    : activeTab === 'series'
                      ? 'Suivi précis par saison et épisode · Connecté en direct à l’API TVMaze'
                      : 'Recherche par titre français, titre original ou alternatif et disponibilités légales en France'}
                </p>
              </div>

              {/* Barre de filtres interactifs */}
              <div className="flex flex-wrap items-center gap-2.5">
                {activeTab === 'anime' && (
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-[#10131c] border border-white/[0.08]">
                    {(
                      [
                        { id: 'all', label: 'Tous formats' },
                        { id: 'tv', label: 'Séries TV' },
                        { id: 'movie', label: 'Films d’animation' },
                      ] as const
                    ).map((fmt) => (
                      <button
                        key={fmt.id}
                        type="button"
                        onClick={() => setAnimeFormatFilter(fmt.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                          animeFormatFilter === fmt.id
                            ? 'bg-white text-[#06070a] font-semibold'
                            : 'text-zinc-300 hover:text-white'
                        }`}
                      >
                        {fmt.label}
                      </button>
                    ))}
                  </div>
                )}

                <select
                  aria-label="Filtrer par genre"
                  value={selectedGenre}
                  onChange={(e) => setSelectedGenre(e.target.value)}
                  className="rounded-xl bg-[#10131c] border border-white/10 px-3.5 py-2 text-xs font-medium text-zinc-200 focus:outline-none focus:border-white/30"
                >
                  <option value="all">Tous les genres</option>
                  {allGenres.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filtrer par plateforme en France"
                  value={selectedPlatform}
                  onChange={(e) => setSelectedPlatform(e.target.value)}
                  className="rounded-xl bg-[#10131c] border border-white/10 px-3.5 py-2 text-xs font-medium text-zinc-200 focus:outline-none focus:border-white/30"
                >
                  <option value="all">Toutes les plateformes (France)</option>
                  <option value="Netflix">Netflix</option>
                  <option value="Canal+">Canal+</option>
                  <option value="Crunchyroll">Crunchyroll</option>
                  <option value="ADN">ADN</option>
                  <option value="Prime Video">Prime Video</option>
                  <option value="Disney+">Disney+</option>
                  <option value="Apple TV">Apple TV</option>
                  <option value="Arte">Arte</option>
                </select>
              </div>
            </div>

            {/* État explicite des API connectées (100% sans clé API requise) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl bg-[#0e111a] border border-white/[0.06] px-4 py-2.5 text-xs text-zinc-400">
              <div>
                <span>Sources actives en direct (sans clé API) : </span>
                <span className="text-emerald-400 font-medium">Apple TV / iTunes France (Films FR)</span>
                <span aria-hidden="true"> · </span>
                <span className="text-emerald-400 font-medium">TVMaze API (Séries & Épisodes)</span>
                <span aria-hidden="true"> · </span>
                <span className="text-emerald-400 font-medium">AniList GraphQL (Anime VO/VF)</span>
              </div>
              <button
                type="button"
                onClick={() => setIsAccountModalOpen(true)}
                className="text-xs text-zinc-200 hover:text-white underline whitespace-nowrap shrink-0"
              >
                Guide GitHub Pages & Sauvegarde
              </button>
            </div>

            {isSearchingApi && (
              <p className="text-xs text-zinc-400 font-mono-tabular">
                Recherche en direct (Apple TV France · TVMaze · AniList) en cours...
              </p>
            )}

            {filteredCatalogItems.length === 0 ? (
              <div className="rounded-2xl bg-[#0e1018] border border-white/[0.07] p-12 text-center space-y-3">
                <p className="font-display text-lg font-semibold text-white">
                  Aucune œuvre ne correspond à ces critères
                </p>
                <p className="text-xs text-zinc-400 max-w-md mx-auto">
                  Essayez un autre titre (français, original ou romaji) ou réinitialisez les filtres de genre et de plateforme.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedGenre('all');
                    setSelectedPlatform('all');
                    setAnimeFormatFilter('all');
                  }}
                  className="px-4 py-2 rounded-lg bg-white text-[#06070a] text-xs font-semibold hover:bg-zinc-200 transition-colors"
                >
                  Réinitialiser les filtres
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {filteredCatalogItems.map((work) => (
                  <MediaPosterCard
                    key={work.id}
                    media={work}
                    entry={libraryMap[work.id]}
                    onOpenDetail={(m, autoOpenPlayer) =>
                      handleOpenDetailModal(m, Boolean(autoOpenPlayer))
                    }
                    onToggleWatchlist={handleToggleWatchlist}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ================= PAGE MA BIBLIOTHÈQUE ================= */}
        {activeTab === 'bibliotheque' && (
          <section className="pt-8 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-white/[0.08] pb-5">
              <div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">
                  Ma bibliothèque personnelle
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                  Retrouvez toutes vos œuvres suivies, filtrez par catégorie et statut, et gérez votre progression.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.07] hover:bg-white/[0.14] text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Exporter / Importer JSON</span>
                </button>
              </div>
            </div>

            {/* Filtres de Ma bibliothèque : Catégorie & Statut */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Filtre par catégorie */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-[#10131c] border border-white/[0.07] w-fit">
                {(
                  [
                    { id: 'all', label: 'Toutes catégories' },
                    { id: 'film', label: 'Films' },
                    { id: 'serie', label: 'Séries' },
                    { id: 'anime', label: 'Anime' },
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setLibCategoryFilter(cat.id)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      libCategoryFilter === cat.id
                        ? 'bg-white text-[#06070a] font-semibold'
                        : 'text-zinc-300 hover:text-white'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Filtre par statut */}
              <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#10131c] border border-white/[0.07]">
                {(
                  [
                    { id: 'all', label: 'Tous' },
                    { id: 'en_cours', label: 'En cours' },
                    { id: 'a_regarder', label: 'À regarder' },
                    { id: 'termine', label: 'Terminé' },
                    { id: 'en_pause', label: 'En pause' },
                    { id: 'abandonne', label: 'Abandonné' },
                    { id: 'favoris', label: '★ Favoris' },
                  ] as const
                ).map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setLibStatusFilter(st.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      libStatusFilter === st.id
                        ? 'bg-[#e11d48] text-white font-semibold'
                        : 'text-zinc-300 hover:text-white'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {myLibraryWorks.length === 0 ? (
              <div className="rounded-2xl bg-[#0e1018] border border-white/[0.07] p-12 text-center space-y-3">
                <p className="font-display text-lg font-semibold text-white">
                  Aucune œuvre dans cette sélection
                </p>
                <p className="text-xs text-zinc-400 max-w-md mx-auto">
                  Ajoutez des films, séries ou anime depuis le catalogue ou changez le filtre de statut ci-dessus.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setLibCategoryFilter('all');
                    setLibStatusFilter('all');
                  }}
                  className="px-4 py-2 rounded-lg bg-white text-[#06070a] text-xs font-semibold hover:bg-zinc-200 transition-colors"
                >
                  Afficher toute ma bibliothèque
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {myLibraryWorks.map((work) => (
                  <MediaPosterCard
                    key={work.id}
                    media={work}
                    entry={libraryMap[work.id]}
                    onOpenDetail={(m, autoOpenPlayer) =>
                      setActiveModalMedia({ media: m, openPlayer: Boolean(autoOpenPlayer) })
                    }
                    onToggleWatchlist={handleToggleWatchlist}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Pied de page sobre et légal */}
      <footer className="border-t border-white/[0.07] bg-[#050609] py-8 px-6 md:px-12 text-xs text-zinc-500">
        <div className="mx-auto max-w-[1440px] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-display font-semibold text-zinc-300">
              NEXUS — Centre personnel pour Films, Séries & Anime japonais
            </p>
            <p className="mt-1">
              Accès exclusivement dédié aux plateformes légales en France (Netflix, Canal+, Crunchyroll, ADN, Prime Video, Disney+, Apple TV, Arte).
            </p>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <button
              type="button"
              onClick={() => setIsAccountModalOpen(true)}
              className="text-zinc-400 hover:text-white transition-colors"
            >
              Sauvegarde JSON & Compte
            </button>
          </div>
        </div>
      </footer>

      {/* Modale Fiche d'une œuvre */}
      {activeModalMedia && (
        <MediaDetailModal
          media={activeModalMedia.media}
          entry={libraryMap[activeModalMedia.media.id]}
          initialOpenPlayer={activeModalMedia.openPlayer}
          allCatalog={fullCatalog}
          onClose={() => setActiveModalMedia(null)}
          onSelectOtherMedia={(other) =>
            setActiveModalMedia({ media: other, openPlayer: false })
          }
          onUpdateStatus={handleUpdateStatus}
          onToggleWatchlist={handleToggleWatchlist}
          onToggleFavorite={handleToggleFavorite}
          onUpdateRating={handleUpdateRating}
          onUpdateWatchedDate={handleUpdateWatchedDate}
          onAddRewatchDate={handleAddRewatchDate}
          onRemoveRewatchDate={handleRemoveRewatchDate}
          onToggleEpisode={handleToggleEpisode}
          onMarkSeason={handleMarkSeason}
          onRemoveFromLibrary={(id) => {
            handleRemoveFromLibrary(id);
            setActiveModalMedia(null);
          }}
        />
      )}

      {/* Modale Compte, Synchronisation Cloud & Export/Import JSON */}
      {isAccountModalOpen && (
        <AccountSyncModal
          user={currentUser}
          libraryMap={libraryMap}
          cloudSyncState={cloudSyncState}
          onClose={() => setIsAccountModalOpen(false)}
          onSignInGoogle={async () => {
            await signInWithGoogle();
          }}
          onSignOut={async () => {
            await signOutUser();
          }}
          onImportLibrary={handleImportLibrary}
        />
      )}
    </div>
  );
}
