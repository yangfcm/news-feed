"use client";

import Image from "next/image";
import { PlayIcon } from "lucide-react";
import { useState } from "react";

/**
 * Shows the thumbnail until clicked, then swaps in the embedded player, so a day with a
 * dozen videos does not load a dozen iframes up front.
 */
export function YouTubePlayer({
  videoId,
  title,
  thumbnail,
  loading = "lazy",
}: {
  videoId: string;
  title: string;
  thumbnail?: string;
  loading?: "eager" | "lazy";
}) {
  const [playing, setPlaying] = useState(false);
  const poster = thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 size-full border-0"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="group absolute inset-0 size-full cursor-pointer"
          aria-label={`Play ${title}`}
        >
          <Image
            src={poster}
            alt=""
            fill
            sizes="(min-width: 1024px) 760px, 100vw"
            loading={loading}
            className="object-cover"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors group-hover:bg-black/25">
            <span className="flex size-14 items-center justify-center rounded-full bg-black/70 text-white transition-transform group-hover:scale-110">
              <PlayIcon className="size-6 translate-x-0.5 fill-current" />
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
