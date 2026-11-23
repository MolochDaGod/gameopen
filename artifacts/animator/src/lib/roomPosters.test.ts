import { describe, expect, it } from "vitest";
import { ROOM_POSTERS_WITHOUT_CDN, roomPosterSrc } from "./roomPosters";

describe("roomPosters", () => {
  it("does not request racing-scene because no CDN or repo copy exists", () => {
    expect(ROOM_POSTERS_WITHOUT_CDN.has("racing")).toBe(true);
    expect(roomPosterSrc("racing")).toBeNull();
  });

  it("still resolves danger so /danger posters keep working", () => {
    const src = roomPosterSrc("danger");
    expect(src).toBeTruthy();
    expect(src).toMatch(/rooms\/danger-scene\.png/);
  });
});
