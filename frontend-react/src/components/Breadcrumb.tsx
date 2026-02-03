import { Link, useNavigate } from 'react-router-dom';

interface BreadcrumbProps {
  label: string;
  to?: string;
  onClick?: () => void;
}

export function Breadcrumb({ label, to, onClick }: BreadcrumbProps) {
  const navigate = useNavigate();
  const handleClick = onClick ?? (to ? () => navigate(to) : undefined);
  const content = (
    <>
      <span style={{ marginRight: 6 }}>←</span>
      {label}
    </>
  );
  const className = 'breadcrumb';
  const style = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '8px 12px',
    borderRadius: 8,
    background: 'var(--accent)',
    border: '1px solid var(--surface-border)',
    color: 'var(--primary)',
    fontWeight: 500,
    textDecoration: 'none' as const,
  };
  if (to && !onClick) {
    return (
      <Link to={to} className={className} style={style}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className={className} style={{ ...style, cursor: 'pointer', font: 'inherit' }} onClick={handleClick}>
      {content}
    </button>
  );
}
