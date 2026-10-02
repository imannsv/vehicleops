/* eslint-disable @next/next/no-img-element */
import { findMake } from '@/lib/vehicle-catalog';
export function BrandLogo({ make }: { make: string }) {
 const brand = findMake(make);
 return <span className="brand-logo" aria-hidden="true">{brand && 'logo' in brand && brand.logo ? <img src={brand.logo} alt="" width={36} height={24} /> : <span>{make.slice(0,2).toUpperCase() || '—'}</span>}</span>;
}
