/** Addresses in the shop, shared by server code (metadata, sitemap) and the client. */

/** A piece's own page. */
export const productHref = (id: string) => `/abaya/${encodeURIComponent(id)}`;

/** The fitting room with a piece. When her own photo can be dressed (`photo`), she starts there with her photo;
 *  otherwise the link asks for the piece on the house model, so no button promises a photo try-on the shop cannot do. */
export const fittingHref = (id: string, photo: boolean) => `/fitting-room?g=${encodeURIComponent(id)}${photo ? '' : '&model=1'}`;

/** The fitting room with a piece, opening straight into the live mirror. */
export const liveHref = (id: string) => `/fitting-room?g=${encodeURIComponent(id)}&live=1`;
