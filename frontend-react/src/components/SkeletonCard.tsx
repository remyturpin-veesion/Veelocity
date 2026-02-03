export function SkeletonCard() {
  return (
    <div className="card" style={{ minHeight: 120 }}>
      <div
        style={{
          width: 40,
          height: 14,
          background: 'var(--surface-border)',
          borderRadius: 4,
          marginBottom: 12,
        }}
      />
      <div
        style={{
          width: 100,
          height: 28,
          background: 'var(--surface-border)',
          borderRadius: 4,
        }}
      />
    </div>
  );
}
