interface EmptyStateProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <p style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>{title}</p>
      <p style={{ margin: 0 }}>{message}</p>
      {actionLabel && onAction && (
        <button type="button" onClick={onAction} style={{ marginTop: 16 }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
