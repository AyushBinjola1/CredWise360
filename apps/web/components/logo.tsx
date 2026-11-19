import './logo.css';

export type LogoVariant = 'icon' | 'wordmark' | 'full';

// Intrinsic proportions of the approved artwork (viewBox width / height of each SVG in /brand).
const artwork: Record<LogoVariant, {file: string; ratio: number; height: number}> = {
  icon: {file: 'icon', ratio: 230.97 / 250.97, height: 40},
  wordmark: {file: 'wordmark', ratio: 610.16 / 75.06, height: 28},
  full: {file: 'logo', ratio: 638.98 / 136.48, height: 36},
};

interface LogoProps {
  variant?: LogoVariant;
  /** Rendered height in CSS pixels. Width follows the artwork proportions. */
  height?: number;
  /** Alternatively set the width; the height follows the artwork proportions. */
  width?: number;
  className?: string;
  /** Use when adjacent text or a link label already names the brand. */
  decorative?: boolean;
}

/**
 * CredWise 360 logo. Both theme artworks are rendered with explicit dimensions, and CSS shows the one that
 * matches the active theme (`data-theme`), so switching themes never reloads an image or shifts the layout.
 */
export function Logo({variant = 'full', height, width, className = '', decorative = false}: LogoProps) {
  const {file, ratio, height: fallback} = artwork[variant];
  const h = height ?? (width ? width / ratio : fallback);
  const w = width ?? h * ratio;
  const dimensions = {width: Math.round(w * 100) / 100, height: Math.round(h * 100) / 100};
  const alt = decorative ? '' : 'CredWise 360';
  return (
    <span className={('logo logo-' + variant + ' ' + className).trim()}>
      <img className="logo-img logo-light" src={`/brand/${file}-light.svg`} alt={alt} {...dimensions} decoding="async" />
      <img className="logo-img logo-dark" src={`/brand/${file}-dark.svg`} alt={alt} {...dimensions} decoding="async" />
    </span>
  );
}
