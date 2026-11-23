import { useEffect, useState } from "react";
import { IconMissing } from "./IconMissing";
import { roomPosterSrc } from "../lib/roomPosters";

/** Room poster from public/rooms or the missing marker when no art exists. */
export function RoomPoster({
  name,
  alt = "",
  className,
}: {
  name: string;
  alt?: string;
  className?: string;
}) {
  const src = roomPosterSrc(name);
  const [missing, setMissing] = useState(!src);
  useEffect(() => {
    setMissing(!src);
  }, [src]);
  if (!src || missing) {
    return <IconMissing className={["icon-missing--poster", className].filter(Boolean).join(" ")} />;
  }
  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      className={className}
      onError={() => setMissing(true)}
    />
  );
}
