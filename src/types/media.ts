export type MediaCategory = 'film' | 'serie' | 'anime';

export type WatchStatus =
  | 'a_regarder'
  | 'en_cours'
  | 'termine'
  | 'en_pause'
  | 'abandonne';

export type OfferType = 'abonnement' | 'gratuit' | 'location' | 'achat';

export interface StreamingAvailability {
  platform:
    | 'Netflix'
    | 'Prime Video'
    | 'Disney+'
    | 'Crunchyroll'
    | 'ADN'
    | 'Canal+'
    | 'Apple TV'
    | 'Arte'
    | 'Max'
    | 'YouTube Films';
  offerType: OfferType;
  verifiedPrice?: string; // Affiché uniquement lorsqu'il est vérifié (ex: "3,99 €", "Inclus")
  officialUrl: string;
  verifiedDate: string; // ex: "Octobre 2026"
  quality?: '4K HDR' | 'HD 1080p';
  audioInfo?: string; // ex: "VF · VOSTFR"
}

export interface EpisodeItem {
  episodeNumber: number;
  titleFr: string;
  titleOriginal?: string;
  durationMinutes: number;
  airDate: string;
  synopsis?: string;
  isSpecialOrMovie?: boolean;
}

export interface SeasonItem {
  seasonNumber: number;
  title: string;
  year: number;
  episodes: EpisodeItem[];
  versionNote?: string; // Permet de distinguer les arcs, films ou versions d'un anime
}

export interface RelatedFranchiseEntry {
  mediaId: string;
  titleFr: string;
  relationType: 'Saison principale' | 'Film d’animation' | 'Préquelle' | 'Suite' | 'Version alternative';
  year: number;
}

export interface MediaWork {
  id: string;
  category: MediaCategory;
  titleFr: string;
  titleOriginal: string;
  altTitles: string[];
  year: number;
  durationLabel: string; // ex: "2h 46m" ou "2 saisons · 28 épisodes"
  genres: string[];
  directorOrStudio: string;
  castOrCreators: string[];
  publicRating: number; // Note publique sur 10 (TMDB / AniList)
  synopsis: string;
  posterUrl: string;
  backdropUrl: string;
  fallbackPosterUrl?: string;
  fallbackBackdropUrl?: string;
  isFeaturedHero?: boolean;
  isNewRelease?: boolean;
  isPopular?: boolean;
  isRecommended?: boolean;
  ageRating: string; // ex: "Tous publics", "12+", "16+"
  country: string;
  seasons?: SeasonItem[]; // Présent pour les séries et les anime
  franchiseId?: string;
  versionLabel?: string; // ex: "Série TV (2023)" vs "Film récapitulatif / Suite"
  relatedEntries?: RelatedFranchiseEntry[];
  availabilitiesFr: StreamingAvailability[];
  officialEmbed?: {
    type: 'youtube_official' | 'arte_official';
    embedUrl: string;
    label: string;
    providerNote: string;
  };
  externalSource?: 'curated' | 'anilist' | 'tvmaze' | 'tmdb';
  externalId?: string;
}

export interface UserLibraryEntry {
  mediaId: string;
  userId: string;
  category: MediaCategory;
  title: string;
  posterUrl: string;
  status: WatchStatus;
  isFavorite: boolean;
  inWatchlist: boolean;
  personalRating?: number; // 1 à 10 facultatif
  watchedDate?: string; // YYYY-MM-DD facultatif
  rewatchDates: string[]; // Historique des revisionnages
  watchedEpisodes: string[]; // Codes au format "S1E1", "S2E4"
  lastWatchedEpisode?: string; // ex: "S1E3"
  totalEpisodesCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface MediaProgressSummary {
  watchedCount: number;
  totalCount: number;
  remainingCount: number;
  percentage: number;
  isCompleted: boolean;
  nextEpisodeToWatch: {
    seasonNumber: number;
    episodeNumber: number;
    code: string;
    titleFr: string;
  } | null;
  lastWatchedEpisodeCode: string | null;
  lastWatchedEpisodeTitle: string | null;
}
