import Link from 'next/link';
import {Logo} from './logo';

/** Home link with the CredWise 360 logo. `responsive` swaps to the icon alone on very narrow screens. */
export function Brand({variant = 'full', height = 34, responsive = false}: {variant?: 'icon' | 'wordmark' | 'full'; height?: number; responsive?: boolean}) {
  return (
    <Link href="/" className="brand" aria-label="CredWise 360 home">
      <Logo variant={variant} height={height} decorative className={responsive ? 'brand-full' : ''} />
      {responsive && <Logo variant="icon" height={Math.round(height * 1.05)} decorative className="brand-compact" />}
    </Link>
  );
}
