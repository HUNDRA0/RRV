interface EditBannerProps {
  onClose: () => void;
}

export function EditBanner({ onClose }: EditBannerProps) {
  return (
    <div className="banner-edit">
      <span className="pulse" />
      Edit mode på · klicka på ett kort för att redigera
      <button className="close" onClick={onClose} aria-label="Stäng">✕</button>
    </div>
  );
}
