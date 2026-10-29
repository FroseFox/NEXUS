import React, { useState } from 'react';
import { Check, Play, Plus, BookmarkCheck } from 'lucide-react';
import { GENERATED_ASSETS } from '../data/catalog';
import { MediaWork, UserLibraryEntry } from '../types/media';
import { calculateMediaProgress } from '../utils/trackingLogic';

interface MediaPosterCardProps {
  media: MediaWork;
  entry?: UserLibraryEntry;
  variant?: 'poster' | 'landscape';
  onOpenDetail: (media: MediaWork, autoOpenPlayer?: boolean) => void;
  onToggleWatchlist: (media: MediaWork) => void;
  onQuickMarkNextEpisode?: (media: MediaWork) => void;
}

const CATEGORY_LABELS: Record<MediaWork['category'], string> = {
  film: 'Film',
  serie: 'Série',
  anime: 'Anime',
};

const STATUS_LABELS: Record<UserLibraryEntry['status'], string> = {
  a_regarder: 'À regarder',
  en_cours: 'En cours',
  termine: 'Terminé',
  en_pause: 'En pause',
  abandonne: 'Abandonné',
};

export const MediaPosterCard: React.FC<MediaPosterCardProps> = ({
  media,
  entry,
  variant = 'poster',
  onOpenDetail,
  onToggleWatchlist,
  onQuickMarkNextEpisode,
}) => {
  const defaultFallback =
    media.category === 'anime'
      ? GENERATED_ASSETS.posterAnimeKeyvisual
      : media.category === 'serie'
        ? GENERATED_ASSETS.posterSeriesPrestige
        : GENERATED_ASSETS.posterFilmScifi;

  const [imgSrc, setImgSrc] = useState<string>(
    variant === 'landscape' ? media.backdropUrl || media.posterUrl : media.posterUrl
  );

  const progress = calculateMediaProgress(media, entry);
  const inWatchlist = Boolean(entry?.inWatchlist);
  const isCompleted = entry?.status === 'termine' || progress.isCompleted;
  const primaryPlatform = media.availabilitiesFr[0]?.platform;

  const handleImageError = () => {
    const fallback =
      variant === 'landscape'
        ? media.fallbackBackdropUrl || GENERATED_ASSETS.heroCinemaBackdrop
        : media.fallbackPosterUrl || defaultFallback;
    if (imgSrc !== fallback) {
      setImgSrc(fallback);
    }
  };

  if (variant === 'landscape') {
    return (
      <article className="group relative flex flex-col rounded-xl bg-[#0e1017] border border-white/[0.07] overflow-hidden transition-transform duration-200 hover:-translate-y-1">
        <div className="relative aspect-video w-full overflow-hidden bg-[#141722]">
          <img
            src={imgSrc}
            alt={`Aperçu de ${media.titleFr}`}
            referrerPolicy="no-referrer"
            onError={handleImageError}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#06070a] via-[#06070a]/45 to-transparent" />

          <div className="absolute bottom-3 left-3.5 right-3.5 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-zinc-300 truncate">
                {CATEGORY_LABELS[media.category]}
                {progress.lastWatchedEpisodeCode ? ` · Dernier vu : ${progress.lastWatchedEpisodeCode}` : ''}
                {primaryPlatform ? ` · ${primaryPlatform}` : ''}
              </p>
              <h3 className="font-display text-base font-semibold text-white truncate">
                {media.titleFr}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onOpenDetail(media, true)}
              aria-label={`Reprendre ${media.titleFr}`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e11d48] text-white transition-transform duration-150 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e11d48]"
            >
              <Play className="h-4 w-4 fill-current" />
            </button>
          </div>

          {progress.totalCount > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/15">
              <div
                className="h-full bg-[#e11d48] transition-all duration-300"
                style={{ width: `${Math.max(6, progress.percentage)}%` }}
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs text-zinc-400">
          <div className="min-w-0 truncate font-mono-tabular">
            {media.category === 'film' ? (
              <span>{entry ? STATUS_LABELS[entry.status] : media.durationLabel}</span>
            ) : (
              <span>
                {progress.watchedCount}/{progress.totalCount} ép. vus · {progress.remainingCount} restants
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {media.category !== 'film' && progress.nextEpisodeToWatch && onQuickMarkNextEpisode && (
              <button
                type="button"
                onClick={() => onQuickMarkNextEpisode(media)}
                className="px-2.5 py-1 text-xs font-medium text-zinc-200 bg-white/[0.06] hover:bg-white/[0.12] rounded-md transition-colors whitespace-nowrap shrink-0"
                title={`Marquer ${progress.nextEpisodeToWatch.code} comme vu`}
              >
                + Vu {progress.nextEpisodeToWatch.code}
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenDetail(media, false)}
              aria-label={`Ouvrir la fiche de ${media.titleFr}`}
              className="px-2.5 py-1 text-xs font-medium text-zinc-300 hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Fiche
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="group relative flex flex-col">
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-[#10131c] border border-white/[0.08] transition-transform duration-200 group-hover:-translate-y-1">
        <img
          src={imgSrc}
          alt={`Affiche de ${media.titleFr}`}
          referrerPolicy="no-referrer"
          onError={handleImageError}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />

        {/* Scrim mesuré pour garantir le contraste sur toutes les affiches */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#06070a]/95 via-[#06070a]/25 to-transparent" />

        {/* Signature éditoriale discrète en bas de l'affiche */}
        <div className="absolute bottom-3 left-3 right-3 pointer-events-none">
          <p className="text-[11px] font-medium text-zinc-300/90 truncate">
            {CATEGORY_LABELS[media.category]} · {media.year}
            {primaryPlatform ? ` · ${primaryPlatform}` : ''}
          </p>
          <p className="font-display text-sm font-semibold text-white leading-snug line-clamp-2">
            {media.titleFr}
          </p>
        </div>

        {/* Barre de progression réelle en bas d'affiche si l'œuvre est suivie */}
        {entry && (progress.watchedCount > 0 || isCompleted) && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/15">
            <div
              className="h-full bg-[#e11d48]"
              style={{ width: `${isCompleted ? 100 : Math.max(8, progress.percentage)}%` }}
            />
          </div>
        )}

        {/* Survol : contrôles rapides accessibles */}
        <div className="absolute inset-0 flex flex-col justify-between p-3 bg-[#06070a]/75 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-zinc-200 font-mono-tabular">
              ★ {media.publicRating.toFixed(1)}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleWatchlist(media);
              }}
              aria-label={
                inWatchlist
                  ? `Retirer ${media.titleFr} de Ma liste`
                  : `Ajouter ${media.titleFr} à Ma liste`
              }
              className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
                inWatchlist
                  ? 'bg-[#e11d48] border-[#e11d48] text-white'
                  : 'bg-black/60 border-white/20 text-zinc-200 hover:border-white'
              }`}
            >
              {inWatchlist ? <BookmarkCheck className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </button>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-zinc-300 line-clamp-3 leading-relaxed">{media.synopsis}</p>
            <button
              type="button"
              onClick={() => onOpenDetail(media, false)}
              className="w-full py-2 px-3 rounded-lg bg-white text-[#06070a] text-xs font-semibold hover:bg-zinc-200 transition-colors whitespace-nowrap"
            >
              Ouvrir la fiche
            </button>
          </div>
        </div>
      </div>

      {/* Métadonnées hors-carte (Zero-Pill Discipline : texte épuré avec séparateurs ·) */}
      <div className="mt-2.5 flex items-baseline justify-between gap-2">
        <button
          type="button"
          onClick={() => onOpenDetail(media, false)}
          className="text-left text-sm font-medium text-zinc-100 hover:text-white truncate focus-visible:underline"
        >
          {media.titleFr}
        </button>
        <span className="text-xs text-zinc-400 font-mono-tabular shrink-0">
          ★ {media.publicRating.toFixed(1)}
        </span>
      </div>

      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-400 truncate">
        <span>{CATEGORY_LABELS[media.category]}</span>
        <span aria-hidden="true">·</span>
        <span className="font-mono-tabular">{media.year}</span>
        {entry ? (
          <>
            <span aria-hidden="true">·</span>
            <span className="text-zinc-200 font-medium flex items-center gap-1">
              {isCompleted && <Check className="h-3 w-3 text-emerald-400 inline" />}
              {media.category === 'film'
                ? STATUS_LABELS[entry.status]
                : `${progress.watchedCount}/${progress.totalCount} ép.`}
            </span>
          </>
        ) : (
          primaryPlatform && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-zinc-300 truncate">{primaryPlatform}</span>
            </>
          )
        )}
      </div>
    </article>
  );
};
