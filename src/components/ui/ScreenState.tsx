import { Spinner } from '@/components/ui/Spinner';

type ScreenStateProps = {
  title: string;
  message?: string;
};

export function LoadingState({ title, message = 'Please wait…' }: ScreenStateProps) {
  return (
    <section className="screen-card fade-in">
      <h2>{title}</h2>
      <p className="muted">{message}</p>
      <Spinner label="Loading" />
    </section>
  );
}

export function ErrorState({ title, message }: ScreenStateProps) {
  return (
    <section className="screen-card error-card fade-in">
      <h2>{title}</h2>
      <p className="muted">{message}</p>
    </section>
  );
}
