interface MetricPlaceholderProps {
  name: string;
}

export function MetricPlaceholder({ name }: MetricPlaceholderProps) {
  return (
    <div>
      <h1 className="screen-title">{name}</h1>
      <div className="card">
        <p className="empty-state">Metric screen (Phase 3).</p>
      </div>
    </div>
  );
}
