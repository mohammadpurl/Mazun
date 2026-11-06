/** The text faces, linked from both document heads: the root layout's and the global 404's. */
const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,300..700;1,8..60,300..500&family=Noto+Naskh+Arabic:wght@400..700&family=Vazirmatn:wght@300;400;500;600&family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..600;1,6..96,400..600&family=Jost:wght@300;400;500&family=Amiri:ital,wght@0,400;0,700;1,400&display=swap';

export function FontLinks() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={FONTS_HREF} />
    </>
  );
}
