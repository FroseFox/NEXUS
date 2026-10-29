import React, { useEffect, useState } from 'react';
import {
  X,
  Play,
  Plus,
  BookmarkCheck,
  Heart,
  Check,
  RotateCcw,
  ExternalLink,
  Calendar,
  Star,
  Tv,
  Film,
  Sparkles,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { GENERATED_ASSETS } from '../data/catalog';
import { MediaWork, UserLibraryEntry, WatchStatus } from '../types/media';
import {
  calculateMediaProgress,
  formatEpisodeCode,
} from '../utils/trackingLogic';

interface MediaDetailModalProps {
  media: MediaWork;
  entry?: UserLibraryEntry;
  initialOpenPlayer?: boolean;
  allCatalog: MediaWork[];
  onClose: () => void;
  onSelectOtherMedia: (media: MediaWork) => void;
  onUpdateStatus: (media: MediaWork, status: WatchStatus) => void;
  onToggleWatchlist: (media: MediaWork) => void;
  onToggleFavorite: (media: MediaWork) => void;
  onUpdateRating: (media: MediaWork, rating: number | undefined) => void;
  onUpdateWatchedDate: (media: MediaWork, date: string) => void;
  onAddRewatchDate: (media: MediaWork, date: string) => void;
  onRemoveRewatchDate: (media: MediaWork, index: number) => void;
  onToggleEpisode: (media: MediaWork, seasonNumber: number, episodeNumber: number) => void;
  onMarkSeason: (media: MediaWork, seasonNumber: number, watched: boolean) => void;
  onRemoveFromLibrary: (mediaId: string) => void;
}

const STATUS_OPTIONS: { value: WatchStatus; label: string }[] = [
  { value: 'a_regarder', label: 'À regarder' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'termine', label: 'Terminé' },
  { value: 'en_pause', label: 'En pause' },
  { value: 'abandonne', label: 'Abandonné' },
];

const OFFER_LABELS: Record<string, string> = {
  abonnement: 'Abonnement',
  gratuit: 'Gratuit',
  location: 'Location VOD',
  achat: 'Achat numérique',
};

export const MediaDetailModal: React.FC<MediaDetailModalProps> = ({
  media,
  entry,
  initialOpenPlayer = false,
  allCatalog,
  onClose,
  onSelectOtherMedia,
  onUpdateStatus,
  onToggleWatchlist,
  onToggleFavorite,
  onUpdateRating,
  onUpdateWatchedDate,
  onAddRewatchDate,
  onRemoveRewatchDate,
  onToggleEpisode,
  onMarkSeason,
  onRemoveFromLibrary,
}) => {
  const progress = calculateMediaProgress(media, entry);

  const defaultSeason =
    progress.nextEpisodeToWatch?.seasonNumber ||
    media.seasons?.[0]?.seasonNumber ||
    1;

  const [selectedSeasonNum, setSelectedSeasonNum] = useState<number>(defaultSeason);
  const [showUnifiedPlayer, setShowUnifiedPlayer] = useState<boolean>(initialOpenPlayer);
  const [activeEpisodeCode, setActiveEpisodeCode] = useState<string>(
    progress.nextEpisodeToWatch?.code ||
      progress.lastWatchedEpisodeCode ||
      (media.seasons?.[0]?.episodes?.[0]
        ? formatEpisodeCode(media.seasons[0].seasonNumber, media.seasons[0].episodes[0].episodeNumber)
        : 'FILM')
  );
  const [newRewatchDate, setNewRewatchDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  const [backdropSrc, setBackdropSrc] = useState<string>(media.backdropUrl || media.posterUrl);
  const [posterSrc, setPosterSrc] = useState<string>(media.posterUrl);

  useEffect(() => {
    setBackdropSrc(media.backdropUrl || media.posterUrl);
    setPosterSrc(media.posterUrl);
    const nextProgress = calculateMediaProgress(media, entry);
    setSelectedSeasonNum(
      nextProgress.nextEpisodeToWatch?.seasonNumber ||
        media.seasons?.[0]?.seasonNumber ||
        1
    );
    setActiveEpisodeCode(
      nextProgress.nextEpisodeToWatch?.code ||
        nextProgress.lastWatchedEpisodeCode ||
        'S1E1'
    );
  }, [media.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const currentSeason = media.seasons?.find((s) => s.seasonNumber === selectedSeasonNum) || media.seasons?.[0];
  const watchedSet = new Set(entry?.watchedEpisodes ?? []);

  const isCurrentSeasonAllWatched =
    currentSeason &&
    currentSeason.episodes.length > 0 &&
    currentSeason.episodes.every((ep) =>
      watchedSet.has(formatEpisodeCode(currentSeason.seasonNumber, ep.episodeNumber))
    );

  const handleResumeNextEpisode = () => {
    if (progress.nextEpisodeToWatch) {
      setSelectedSeasonNum(progress.nextEpisodeToWatch.seasonNumber);
      setActiveEpisodeCode(progress.nextEpisodeToWatch.code);
      setShowUnifiedPlayer(true);
    } else {
      setShowUnifiedPlayer(true);
    }
  };

  const categoryLabel =
    media.category === 'film'
      ? 'Film'
      : media.category === 'serie'
        ? 'Série'
        : 'Anime japonais';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-media-title"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/85 backdrop-blur-sm p-3 sm:p-6 md:p-10"
    >
      <div className="relative w-full max-w-5xl rounded-2xl bg-[#0b0d14] border border-white/10 overflow-hidden my-auto">
        {/* Bouton Fermer haut contraste */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer la fiche"
          className="absolute top-4 right-4 z-30 flex h-10 w-10 items-center justify-center rounded-xl bg-black/75 border border-white/15 text-zinc-200 hover:bg-white hover:text-black transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Bannière héroïque de l'œuvre */}
        <div className="relative min-h-[340px] sm:min-h-[400px] w-full overflow-hidden bg-[#121521]">
          <img
            src={backdropSrc}
            alt={`Image de fond de ${media.titleFr}`}
            referrerPolicy="no-referrer"
            onError={() =>
              setBackdropSrc(
                media.fallbackBackdropUrl || GENERATED_ASSETS.heroCinemaBackdrop
              )
            }
            className="absolute inset-0 h-full w-full object-cover opacity-55"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0d14] via-[#0b0d14]/75 to-black/30" />

          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-end gap-6 p-6 sm:p-8 pt-16 sm:pt-24">
            <img
              src={posterSrc}
              alt={`Affiche de ${media.titleFr}`}
              referrerPolicy="no-referrer"
              onError={() =>
                setPosterSrc(
                  media.fallbackPosterUrl || GENERATED_ASSETS.posterFilmScifi
                )
              }
              className="hidden sm:block w-36 md:w-44 aspect-[2/3] object-cover rounded-xl border border-white/15 shrink-0"
            />

            <div className="flex-1 min-w-0 space-y-3">
              {/* Kicker non encadré (Zero-Pill Discipline) */}
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-300">
                <span className="text-[#e11d48] font-semibold">{categoryLabel}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular">{media.year}</span>
                <span aria-hidden="true">·</span>
                <span>{media.durationLabel}</span>
                <span aria-hidden="true">·</span>
                <span>{media.ageRating}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular text-amber-400">
                  ★ {media.publicRating.toFixed(1)}/10
                </span>
              </div>

              <h1
                id="modal-media-title"
                className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-white"
              >
                {media.titleFr}
              </h1>

              {(media.titleOriginal !== media.titleFr || media.altTitles.length > 0) && (
                <p className="text-xs sm:text-sm text-zinc-400">
                  Titre original : <span className="text-zinc-200">{media.titleOriginal}</span>
                  {media.altTitles.length > 0 && (
                    <span> · Aussi connu sous : {media.altTitles.join(' / ')}</span>
                  )}
                </p>
              )}

              {media.versionLabel && (
                <p className="text-xs text-zinc-300">
                  Édition / Version suivie : <span className="font-medium text-white">{media.versionLabel}</span>
                </p>
              )}

              <p className="text-xs text-zinc-400">
                {media.genres.join(' · ')} — Réalisation / Studio :{' '}
                <span className="text-zinc-200">{media.directorOrStudio}</span>
              </p>

              {/* Actions principales */}
              <div className="pt-2 flex flex-wrap items-center gap-3">
                {media.category !== 'film' && progress.nextEpisodeToWatch ? (
                  <button
                    type="button"
                    onClick={handleResumeNextEpisode}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#e11d48] hover:bg-[#be123c] text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    <span>
                      Reprendre {progress.nextEpisodeToWatch.code} — {progress.nextEpisodeToWatch.titleFr}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowUnifiedPlayer((v) => !v)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#e11d48] hover:bg-[#be123c] text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    <span>
                      {showUnifiedPlayer ? 'Masquer la salle de visionnage' : 'Regarder depuis NEXUS'}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onToggleWatchlist(media)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                    entry?.inWatchlist
                      ? 'bg-white text-[#06070a] border-white'
                      : 'bg-white/[0.06] border-white/15 text-zinc-100 hover:bg-white/[0.12]'
                  }`}
                >
                  {entry?.inWatchlist ? (
                    <>
                      <BookmarkCheck className="h-4 w-4" />
                      <span>Dans Ma liste</span>
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      <span>Ajouter à Ma liste</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onToggleFavorite(media)}
                  aria-label={
                    entry?.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'
                  }
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                    entry?.isFavorite
                      ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                      : 'bg-white/[0.06] border-white/15 text-zinc-200 hover:bg-white/[0.12]'
                  }`}
                >
                  <Heart
                    className={`h-4 w-4 ${entry?.isFavorite ? 'fill-current text-rose-400' : ''}`}
                  />
                  <span>Favori</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Corps de la fiche */}
        <div className="p-6 sm:p-8 space-y-8">
          {/* Salle de visionnage unifiée NEXUS (Section 6) */}
          {showUnifiedPlayer && (
            <section className="rounded-xl bg-[#06070a] border border-white/10 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold text-white">
                    Salle de visionnage NEXUS — {media.titleFr}
                    {media.category !== 'film' ? ` (${activeEpisodeCode})` : ''}
                  </h2>
                  <p className="text-xs text-zinc-400">
                    {media.officialEmbed?.label || 'Lecteur officiel & Accès direct aux plateformes légales'}
                  </p>
                </div>

                {media.category !== 'film' && progress.nextEpisodeToWatch && (
                  <button
                    type="button"
                    onClick={() => {
                      const ep = progress.nextEpisodeToWatch!;
                      onToggleEpisode(media, ep.seasonNumber, ep.episodeNumber);
                    }}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>
                      Marquer {progress.nextEpisodeToWatch.code} comme terminé
                    </span>
                  </button>
                )}
              </div>

              {media.officialEmbed ? (
                <div className="aspect-video w-full overflow-hidden rounded-lg bg-black border border-white/10">
                  <iframe
                    src={media.officialEmbed.embedUrl}
                    title={`Lecteur officiel ${media.titleFr}`}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="aspect-video w-full flex flex-col items-center justify-center rounded-lg bg-[#0e1018] border border-white/10 p-6 text-center space-y-3">
                  <Tv className="h-10 w-10 text-zinc-400" />
                  <p className="text-sm font-medium text-zinc-200 max-w-lg">
                    Ce programme nécessite l’authentification abonné sur le lecteur officiel du diffuseur.
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-white/10 text-xs text-zinc-400">
                <p className="leading-relaxed">
                  <strong className="text-zinc-200">Transparence technique & légale :</strong>{' '}
                  {media.officialEmbed?.providerNote ||
                    'Les flux complets par abonnement (Netflix, Canal+, Crunchyroll, Disney+, ADN, Apple TV+) utilisent une protection DRM Widevine/FairPlay qui interdit l’intégration iframe tierce. Cliquez sur un fournisseur officiel ci-dessous pour ouvrir directement l’œuvre tout en conservant votre suivi d’épisode sur NEXUS.'}
                </p>

                <div className="flex items-center gap-2 shrink-0">
                  {media.availabilitiesFr.map((av) => (
                    <a
                      key={av.platform}
                      href={av.officialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white text-[#06070a] font-semibold hover:bg-zinc-200 transition-colors whitespace-nowrap"
                    >
                      <span>Lancer sur {av.platform}</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Synopsis & Distinction de franchise (Anime / Versions) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div>
                <h2 className="font-display text-lg font-semibold text-white mb-2">Synopsis</h2>
                <p className="text-sm sm:text-base text-zinc-300 leading-relaxed">
                  {media.synopsis}
                </p>
                {media.castOrCreators.length > 0 && (
                  <p className="mt-3 text-xs text-zinc-400">
                    Distribution & Création :{' '}
                    <span className="text-zinc-200">{media.castOrCreators.join(' · ')}</span>
                  </p>
                )}
              </div>

              {/* Versions distinctes d'une même franchise (Section 3 & 4 : Ne jamais confondre deux versions d'un anime) */}
              {media.relatedEntries && media.relatedEntries.length > 0 && (
                <div className="rounded-xl bg-[#10131d] border border-white/10 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">
                      Franchise & Versions distinctes (Suivi séparé)
                    </h3>
                    <span className="text-xs text-zinc-400">
                      Aucune confusion entre série TV et films
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {media.relatedEntries.map((rel) => {
                      const target = allCatalog.find((c) => c.id === rel.mediaId);
                      if (!target) return null;
                      return (
                        <button
                          key={rel.mediaId}
                          type="button"
                          onClick={() => onSelectOtherMedia(target)}
                          className="flex items-center justify-between gap-4 px-3.5 py-2.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] border border-white/10 text-left transition-colors"
                        >
                          <div>
                            <p className="text-xs text-[#e11d48] font-medium">
                              {rel.relationType} · {rel.year}
                            </p>
                            <p className="text-sm font-medium text-white">{rel.titleFr}</p>
                          </div>
                          <span className="text-xs text-zinc-300 underline whitespace-nowrap">
                            Ouvrir cette version
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Où regarder en France (Section 5) */}
              <div className="space-y-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-display text-lg font-semibold text-white">
                    Où regarder en France (Offres légales)
                  </h2>
                  <span className="text-xs text-zinc-400">
                    Liens directs vers les plateformes officielles
                  </span>
                </div>

                <div className="divide-y divide-white/[0.07] rounded-xl bg-[#10131c] border border-white/[0.08] overflow-hidden">
                  {media.availabilitiesFr.map((offer, idx) => (
                    <div
                      key={`${offer.platform}-${idx}`}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm font-semibold text-white">
                          <span>{offer.platform}</span>
                          <span className="text-zinc-500" aria-hidden="true">
                            ·
                          </span>
                          <span className="text-xs font-normal text-zinc-300">
                            {OFFER_LABELS[offer.offerType] || offer.offerType}
                          </span>
                          {offer.verifiedPrice && (
                            <>
                              <span className="text-zinc-500" aria-hidden="true">
                                ·
                              </span>
                              <span className="text-xs font-mono-tabular text-emerald-400">
                                {offer.verifiedPrice}
                              </span>
                            </>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400">
                          {offer.quality ? `${offer.quality} · ` : ''}
                          {offer.audioInfo ? `${offer.audioInfo} · ` : ''}
                          Vérifié : {offer.verifiedDate}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={offer.officialUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.08] hover:bg-white text-white hover:text-[#06070a] text-xs font-semibold transition-colors whitespace-nowrap"
                        >
                          <span>Regarder sur {offer.platform}</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Colonne de droite : Suivi personnel (Statut, Note, Date, Revisionnages) */}
            <aside className="rounded-xl bg-[#10131c] border border-white/[0.08] p-5 space-y-5 h-fit">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-semibold text-white">
                  Mon suivi personnel
                </h2>
                {entry && (
                  <button
                    type="button"
                    onClick={() => onRemoveFromLibrary(media.id)}
                    aria-label="Retirer de ma bibliothèque"
                    className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Effacer</span>
                  </button>
                )}
              </div>

              {/* Sélecteur de statut (5 statuts exigés) */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-zinc-400">
                  Statut dans ma bibliothèque
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {STATUS_OPTIONS.map((opt) => {
                    const isSelected = entry?.status === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => onUpdateStatus(media, opt.value)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors whitespace-nowrap ${
                          isSelected
                            ? 'bg-[#e11d48] text-white font-semibold'
                            : 'bg-white/[0.04] text-zinc-300 hover:bg-white/[0.09]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Pour un film : Bouton rapide Vu / Non vu */}
              {media.category === 'film' && (
                <div className="pt-2 border-t border-white/[0.07] flex items-center justify-between">
                  <span className="text-xs text-zinc-300">Visionnage du film</span>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateStatus(
                        media,
                        entry?.status === 'termine' ? 'a_regarder' : 'termine'
                      )
                    }
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      entry?.status === 'termine'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-white/[0.07] text-zinc-200 hover:bg-white/[0.14]'
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>{entry?.status === 'termine' ? 'Film vu' : 'Marquer comme vu'}</span>
                  </button>
                </div>
              )}

              {/* Note personnelle facultative (1 à 10) */}
              <div className="pt-2 border-t border-white/[0.07] space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
                    <Star className="h-3.5 w-3.5 text-amber-400" />
                    <span>Note personnelle (facultative)</span>
                  </label>
                  {entry?.personalRating && (
                    <button
                      type="button"
                      onClick={() => onUpdateRating(media, undefined)}
                      className="text-[11px] text-zinc-400 hover:text-white"
                    >
                      Retirer ({entry.personalRating}/10)
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                    const active = entry?.personalRating === num;
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => onUpdateRating(media, num)}
                        aria-label={`Noter ${num} sur 10`}
                        className={`py-1.5 rounded text-xs font-mono-tabular transition-colors ${
                          active
                            ? 'bg-amber-400 text-black font-bold'
                            : 'bg-white/[0.04] text-zinc-300 hover:bg-white/[0.1]'
                        }`}
                      >
                        {num}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date de visionnage facultative */}
              <div className="pt-2 border-t border-white/[0.07] space-y-2">
                <label
                  htmlFor="watched-date-input"
                  className="block text-xs font-medium text-zinc-400"
                >
                  Date de visionnage (facultative)
                </label>
                <input
                  id="watched-date-input"
                  type="date"
                  value={entry?.watchedDate || ''}
                  onChange={(e) => onUpdateWatchedDate(media, e.target.value)}
                  className="w-full rounded-lg bg-[#06070a] border border-white/10 px-3 py-2 text-xs text-white font-mono-tabular focus:outline-none focus:border-white/30"
                />
              </div>

              {/* Historique des revisionnages */}
              <div className="pt-2 border-t border-white/[0.07] space-y-2.5">
                <span className="block text-xs font-medium text-zinc-400">
                  Historique des revisionnages ({entry?.rewatchDates.length || 0})
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    aria-label="Date de revisionnage"
                    value={newRewatchDate}
                    onChange={(e) => setNewRewatchDate(e.target.value)}
                    className="flex-1 rounded-lg bg-[#06070a] border border-white/10 px-2.5 py-1.5 text-xs text-white font-mono-tabular"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newRewatchDate) onAddRewatchDate(media, newRewatchDate);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-xs font-medium text-white whitespace-nowrap shrink-0"
                  >
                    + Ajouter
                  </button>
                </div>

                {entry?.rewatchDates && entry.rewatchDates.length > 0 && (
                  <ul className="space-y-1 text-xs text-zinc-300 font-mono-tabular">
                    {entry.rewatchDates.map((d, index) => (
                      <li
                        key={`${d}-${index}`}
                        className="flex items-center justify-between py-1 px-2 rounded bg-white/[0.03]"
                      >
                        <span>Revu le {d}</span>
                        <button
                          type="button"
                          onClick={() => onRemoveRewatchDate(media, index)}
                          className="text-zinc-500 hover:text-rose-400"
                        >
                          Supprimer
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </aside>
          </div>

          {/* Suivi précis des Saisons et Épisodes (pour Séries & Anime) */}
          {media.category !== 'film' && media.seasons && media.seasons.length > 0 && (
            <section className="pt-6 border-t border-white/10 space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-xl font-semibold text-white">
                    Suivi des saisons et épisodes
                  </h2>
                  <p className="text-xs text-zinc-400 font-mono-tabular mt-0.5">
                    {progress.watchedCount} sur {progress.totalCount} épisodes vus ·{' '}
                    {progress.remainingCount} restants · Progression : {progress.percentage}%
                    {progress.lastWatchedEpisodeCode
                      ? ` · Dernier vu : ${progress.lastWatchedEpisodeCode}`
                      : ''}
                  </p>
                </div>

                {/* Barre de progression visuelle */}
                <div className="w-full md:w-72 space-y-1.5">
                  <div className="flex justify-between text-xs font-mono-tabular text-zinc-300">
                    <span>Progression globale</span>
                    <span>{progress.percentage}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-[#e11d48] transition-all duration-300"
                      style={{ width: `${progress.percentage}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Onglets de sélection de saison + bouton Marquer toute la saison */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-[#10131c] border border-white/[0.07]">
                  {media.seasons.map((season) => {
                    const seasonWatchedCount = season.episodes.filter((ep) =>
                      watchedSet.has(formatEpisodeCode(season.seasonNumber, ep.episodeNumber))
                    ).length;
                    const active = season.seasonNumber === currentSeason?.seasonNumber;

                    return (
                      <button
                        key={season.seasonNumber}
                        type="button"
                        onClick={() => setSelectedSeasonNum(season.seasonNumber)}
                        className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-white text-[#06070a] font-semibold'
                            : 'text-zinc-300 hover:text-white'
                        }`}
                      >
                        {season.title} ({seasonWatchedCount}/{season.episodes.length})
                      </button>
                    );
                  })}
                </div>

                {currentSeason && (
                  <button
                    type="button"
                    onClick={() =>
                      onMarkSeason(
                        media,
                        currentSeason.seasonNumber,
                        !isCurrentSeasonAllWatched
                      )
                    }
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.07] hover:bg-white/[0.14] text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
                  >
                    {isCurrentSeasonAllWatched ? (
                      <>
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Annuler le statut vu de la saison {currentSeason.seasonNumber}</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Marquer toute la saison {currentSeason.seasonNumber} comme terminée</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {currentSeason?.versionNote && (
                <p className="text-xs text-zinc-400">
                  Note de saison : <span className="text-zinc-200">{currentSeason.versionNote}</span>
                </p>
              )}

              {/* Liste des épisodes de la saison sélectionnée */}
              {currentSeason && (
                <div className="divide-y divide-white/[0.06] rounded-xl bg-[#10131c] border border-white/[0.08] overflow-hidden">
                  {currentSeason.episodes.map((ep) => {
                    const code = formatEpisodeCode(
                      currentSeason.seasonNumber,
                      ep.episodeNumber
                    );
                    const isWatched = watchedSet.has(code);
                    const isNextToWatch = progress.nextEpisodeToWatch?.code === code;

                    return (
                      <div
                        key={code}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 transition-colors ${
                          isWatched ? 'bg-white/[0.01]' : 'hover:bg-white/[0.03]'
                        }`}
                      >
                        <div className="flex items-start gap-3.5 min-w-0">
                          <span className="font-mono-tabular text-xs font-semibold text-zinc-400 pt-0.5 w-12 shrink-0">
                            {code}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3
                                className={`text-sm font-medium ${
                                  isWatched ? 'text-zinc-400 line-through' : 'text-white'
                                }`}
                              >
                                {ep.titleFr}
                              </h3>
                              {isNextToWatch && (
                                <span className="text-xs font-semibold text-[#e11d48]">
                                  · À reprendre
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-400 font-mono-tabular mt-0.5">
                              {ep.durationMinutes} min · Diffusion : {ep.airDate}
                              {ep.titleOriginal ? ` · VO : ${ep.titleOriginal}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveEpisodeCode(code);
                              setShowUnifiedPlayer(true);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.12] text-xs font-medium text-zinc-200 transition-colors whitespace-nowrap"
                          >
                            Regarder
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              onToggleEpisode(
                                media,
                                currentSeason.seasonNumber,
                                ep.episodeNumber
                              )
                            }
                            aria-label={
                              isWatched
                                ? `Annuler le statut vu de ${code}`
                                : `Marquer ${code} comme vu`
                            }
                            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                              isWatched
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                                : 'bg-white text-[#06070a] hover:bg-zinc-200'
                            }`}
                          >
                            {isWatched ? (
                              <>
                                <Check className="h-3.5 w-3.5" />
                                <span>Vu · Annuler</span>
                              </>
                            ) : (
                              <span>Marquer comme vu</span>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
