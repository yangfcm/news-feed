"use client";

/** The browser's own player; preload="none" so nothing downloads until play is pressed. */
export function AudioPlayer({ src, title }: { src: string; title: string }) {
  return (
    <audio
      controls
      preload="none"
      src={src}
      aria-label={title}
      className="w-full"
      onPlay={(e) => {
        for (const audio of document.querySelectorAll("audio")) {
          if (audio !== e.currentTarget) audio.pause();
        }
      }}
    >
      <a href={src}>Download audio</a>
    </audio>
  );
}
