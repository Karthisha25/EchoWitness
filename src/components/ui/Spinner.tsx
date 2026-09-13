type SpinnerProps = {
  label?: string;
  size?: 'sm' | 'md';
};

export function Spinner({ label, size = 'md' }: SpinnerProps) {
  return (
    <span className={`spinner-wrap spinner-wrap--${size}`}>
      <span className="spinner" aria-hidden="true" />
      {label && <span>{label}</span>}
    </span>
  );
}

type ProcessingBannerProps = {
  title: string;
  detail?: string;
};

export function ProcessingBanner({ title, detail }: ProcessingBannerProps) {
  return (
    <div className="processing-banner" role="status" aria-live="polite">
      <Spinner />
      <div>
        <p className="processing-banner__title">{title}</p>
        {detail && <p className="muted small">{detail}</p>}
      </div>
    </div>
  );
}
