'use client';

import Image from 'next/image';
import { Camera, Check, Plus, Trash2 } from 'lucide-react';
import { Photo, shots } from '@/lib/domain';

const positions: Record<string, string> = {
  'Vorne': 'front',
  'Vorne links': 'front-left',
  'Vorne rechts': 'front-right',
  'Links': 'left',
  'Rechts': 'right',
  'Hinten links': 'rear-left',
  'Hinten rechts': 'rear-right',
  'Hinten': 'rear',
};

function VehicleIllustration() {
  return (
    <svg viewBox="0 0 220 420" role="img" aria-label="Auto aus der Vogelperspektive, Fahrzeugfront oben" className="walkaround-car">
      <defs>
        <linearGradient id="vehicle-body" x1="0" x2="1">
          <stop offset="0" stopColor="#b9c6d4" />
          <stop offset=".18" stopColor="#e7edf3" />
          <stop offset=".5" stopColor="#f7f9fc" />
          <stop offset=".82" stopColor="#e7edf3" />
          <stop offset="1" stopColor="#b9c6d4" />
        </linearGradient>
        <linearGradient id="vehicle-glass" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#233a53" />
          <stop offset="1" stopColor="#526e89" />
        </linearGradient>
      </defs>
      {/* Front is up; the left side is the vehicle's left side. */}
      <rect x="29" y="83" width="16" height="58" rx="5" fill="#243349" />
      <rect x="175" y="83" width="16" height="58" rx="5" fill="#243349" />
      <rect x="29" y="282" width="16" height="57" rx="5" fill="#243349" />
      <rect x="175" y="282" width="16" height="57" rx="5" fill="#243349" />
      <path d="M46 56 Q50 22 79 18 Q110 12 141 18 Q170 22 174 56 L181 105 L179 327 Q176 384 157 398 Q110 412 63 398 Q44 384 41 327 L39 105 Z" fill="url(#vehicle-body)" stroke="#8b9eb3" strokeWidth="2" />
      <path d="M64 40 Q110 29 156 40" fill="none" stroke="#9aaec1" strokeWidth="2" />
      <path d="M57 53 L75 46 L75 58 L55 66 Z M163 53 L145 46 L145 58 L165 66 Z" fill="#fff" stroke="#a6b8ca" />
      <path d="M82 27 L138 27" stroke="#6b8299" strokeWidth="4" strokeLinecap="round" />
      <path d="M61 75 L68 117 M159 75 L152 117" stroke="#bdc9d5" strokeWidth="1.5" />
      <path d="M66 120 Q110 112 154 120 L161 167 Q110 151 59 167 Z" fill="url(#vehicle-glass)" stroke="#8194a9" strokeWidth="2" />
      <path d="M75 125 Q104 120 127 122" fill="none" stroke="#7e9ab5" strokeWidth="2" opacity=".8" />
      <path d="M65 175 Q110 159 155 175 L151 286 Q110 299 69 286 Z" fill="#e2eaf1" stroke="#a8bacb" strokeWidth="1.5" />
      <path d="M74 185 Q110 176 146 185 L144 244 Q110 250 76 244 Z" fill="url(#vehicle-glass)" stroke="#92a6ba" strokeWidth="1.5" />
      <path d="M86 189 L137 189 L133 236" fill="none" stroke="#9ab1c7" strokeWidth="2" opacity=".5" />
      <path d="M54 172 L59 191 L62 281 L51 300 Z M166 172 L161 191 L158 281 L169 300 Z" fill="#2e455d" stroke="#8da2b6" strokeWidth="1.5" />
      <path d="M55 225 L61 225 M159 225 L165 225" stroke="#c0cedb" strokeWidth="4" />
      <path d="M60 301 Q110 316 160 301 L155 343 Q110 354 65 343 Z" fill="url(#vehicle-glass)" stroke="#8194a9" strokeWidth="2" />
      <path d="M73 334 Q110 341 148 334" stroke="#8aa5be" strokeWidth="2" fill="none" />
      <path d="M26 160 Q24 147 42 147 L49 162 Z M194 160 Q196 147 178 147 L171 162 Z" fill="#c7d4e1" stroke="#8b9eb3" strokeWidth="1.5" />
      <path d="M54 365 L74 373 L72 383 L54 378 Z M166 365 L146 373 L148 383 L166 378 Z" fill="#d66870" stroke="#ac5863" />
      <path d="M75 389 Q110 394 145 389" fill="none" stroke="#a0b1c2" strokeWidth="2" />
      <path d="M84 368 L136 368" stroke="#a5b6c6" strokeWidth="2" />
      <path d="M47 188 L45 273 M173 188 L175 273" stroke="#9fb2c4" />
    </svg>
  );
}

export function PhotoWalkaround({ photos, disabled, onPhotos, onRemovePhoto }: {
  photos: Photo[];
  disabled: boolean;
  onPhotos: (slot: string, files: File[]) => Promise<void>;
  onRemovePhoto: (index: number) => void;
}) {
  const interiorPhotos = photos.filter(photo => photo.slot === 'Innenraum');
  function photoSlot(slot: string, position?: string) {
    const photo = photos.find(p => p.slot === slot);
    return (
      <label key={slot} className={`walkaround-slot ${position ? `position-${position}` : 'interior-slot'} ${photo ? 'has-photo' : ''} ${disabled ? 'is-disabled' : ''}`}>
        {photo ? <Image src={photo.url} alt={slot} width={240} height={160} unoptimized /> : <span className="walkaround-camera"><Camera size={21} /><Plus size={10} /></span>}
        <span className="walkaround-slot-label">{slot}{photo && <Check size={13} strokeWidth={3} />}</span>
        <input aria-label={`Foto ${slot}`} type="file" accept="image/*" capture="environment" disabled={disabled} onChange={async event => {
          const file = event.currentTarget.files?.[0];
          // Let the same file be selected again when replacing a photograph.
          event.currentTarget.value = '';
          if (file) await onPhotos(slot, [file]);
        }} />
      </label>
    );
  }

  return (
    <div className="photo-walkaround">
      <div className="walkaround-map" role="group" aria-label="Außenaufnahmen rund um das Fahrzeug">
        <svg className="walkaround-guide" viewBox="0 0 600 480" preserveAspectRatio="none" aria-hidden="true"><ellipse cx="300" cy="240" rx="208" ry="188" fill="none" stroke="#dce6f2" strokeWidth="1.5" strokeDasharray="4 7" /></svg>
        <div className="walkaround-vehicle"><VehicleIllustration /></div>
        {shots.filter(slot => positions[slot]).map(slot => photoSlot(slot, positions[slot]))}
      </div>
      <p className="walkaround-hint"><Camera size={14} /> Position antippen, um ein Foto aufzunehmen oder hinzuzufügen.</p>
      <div className="walkaround-interior" role="group" aria-label="Innenaufnahmen">
        <div className="interior-collection">
          <div className="interior-heading"><strong>Innenraum</strong><span>{interiorPhotos.length} {interiorPhotos.length === 1 ? 'Bild' : 'Bilder'}</span></div>
          <p className="muted small">Mindestens ein Foto. Weitere Bilder nach Bedarf hinzufügen.</p>
          <div className="interior-actions">
            <label className={`interior-picker ${disabled ? 'is-disabled' : ''}`}><Plus size={15} /> Bilder hinzufügen
              <input aria-label="Foto Innenraum" type="file" accept="image/*" multiple disabled={disabled} onChange={async event => {
                const files = Array.from(event.currentTarget.files ?? []);
                event.currentTarget.value = '';
                if (files.length) await onPhotos('Innenraum', files);
              }} />
            </label>
            <label className={`interior-picker ${disabled ? 'is-disabled' : ''}`}><Camera size={15} /> Aufnehmen
              <input aria-label="Innenraumfoto aufnehmen" type="file" accept="image/*" capture="environment" disabled={disabled} onChange={async event => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = '';
                if (file) await onPhotos('Innenraum', [file]);
              }} />
            </label>
          </div>
          {interiorPhotos.length > 0 && <div className="interior-previews">{interiorPhotos.map((photo, index) => <div className="interior-preview" key={photos.indexOf(photo)}>
            <Image src={photo.url} alt={`Innenraumfoto ${index + 1}`} width={240} height={160} unoptimized />
            <span>Innenraum {index + 1}</span>
            <button type="button" aria-label={`Innenraumfoto ${index + 1} entfernen`} disabled={disabled} onClick={() => onRemovePhoto(photos.indexOf(photo))}><Trash2 size={14} /></button>
          </div>)}</div>}
        </div>
        {photoSlot('Tacho')}
      </div>
    </div>
  );
}
