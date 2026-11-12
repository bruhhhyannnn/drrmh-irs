import { campusLogo } from '@/lib/campus-logo';

/**
 * The campus logo, large and faded, behind the top of a page (event details, the campus page):
 * top-right and partly off the edge, blurred, fading out by the first cards, with a faint maroon
 * wash. Decorative only. The admin shell isolates its stacking, so this paints over the canvas and
 * under the content; cards stay solid surface, so their contrast doesn't change.
 */
export function CampusBackdrop({ name }: { name: string }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-150 overflow-hidden [mask-image:linear-gradient(to_bottom,#000_30%,transparent)]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(161,29,29,.07),transparent_60%)]" />
      <div
        className="absolute -top-20 -right-24 size-85 bg-contain bg-center bg-no-repeat opacity-(--campus-backdrop-opacity) blur-[4px] md:-top-28 md:-right-36 md:size-140"
        style={{ backgroundImage: `url(${campusLogo(name)})` }}
      />
    </div>
  );
}
