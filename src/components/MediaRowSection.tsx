import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MediaWork, UserLibraryEntry } from '../types/media';
import { MediaPosterCard } from './MediaPosterCard';

interface MediaRowSectionProps {
  title: string;
  subtitle?: string;
  items: MediaWork[];
  libraryMap: Record<string, UserLibraryEntry>;
  variant?: 'poster' | 'landscape';
  onOpenDetail: (media: MediaWork, autoOpenPlayer?: boolean) => void;
  onToggleWatchlist: (media: MediaWork) => void;
  onQuickMarkNextEpisode?: (media: MediaWork) => void;
}

export const MediaRowSection: React.FC<MediaRowSectionProps> = ({
  title,
  subtitle,
  items,
  libraryMap,
  variant = 'poster',
  onOpenDetail,
  onToggleWatchlist,
  onQuickMarkNextEpisode,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (items.length === 0) {
    return null;
  }

  const handleScroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const offset = direction === 'left' ? -680 : 680;
    scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  return (
    <section className="py-5">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl md:text-2xl font-semibold tracking-tight text-white">
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-xs md:text-sm text-zinc-400">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-zinc-500 font-mono-tabular mr-1">
            {items.length} {items.length > 1 ? 'œuvres' : 'œuvre'}
          </span>
          <button
            type="button"
            onClick={() => handleScroll('left')}
            aria-label={`Défiler ${title} vers la gauche`}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-[#10131c] text-zinc-300 hover:border-white/25 hover:text-white transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleScroll('right')}
            aria-label={`Défiler ${title} vers la droite`}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-[#10131c] text-zinc-300 hover:border-white/25 hover:text-white transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-5 overflow-x-auto no-scrollbar pb-2 scroll-smooth"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className={
              variant === 'landscape'
                ? 'w-[290px] sm:w-[330px] shrink-0'
                : 'w-[175px] sm:w-[205px] shrink-0'
            }
          >
            <MediaPosterCard
              media={item}
              entry={libraryMap[item.id]}
              variant={variant}
              onOpenDetail={onOpenDetail}
              onToggleWatchlist={onToggleWatchlist}
              onQuickMarkNextEpisode={onQuickMarkNextEpisode}
            />
          </div>
        ))}
      </div>
    </section>
  );
};
