interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
}

export default function StatsCard({ title, value, subtitle, icon }: StatsCardProps) {
  return (
    <div 
      className="rounded-lg shadow-md p-6 border"
      style={{
        backgroundColor: 'rgb(255, 255, 255)',
        borderColor: 'rgba(0, 0, 0, 0.1)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-body-small font-medium" style={{ color: 'rgb(114, 114, 114)', fontSize: '14px', lineHeight: '1.7em' }}>{title}</p>
          <p className="mt-2" style={{ fontSize: '48px', fontWeight: 'bold', color: 'rgb(0, 0, 0)', lineHeight: '1em' }}>{value}</p>
          {subtitle && (
            <p className="mt-1" style={{ fontSize: '12px', color: 'rgb(114, 114, 114)', lineHeight: '1.4em' }}>{subtitle}</p>
          )}
        </div>
        {icon && (
          <div style={{ color: 'rgb(240, 167, 65)' }}>{icon}</div>
        )}
      </div>
    </div>
  );
}

