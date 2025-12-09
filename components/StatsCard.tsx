interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
}

export default function StatsCard({ title, value, subtitle, icon }: StatsCardProps) {
  return (
    <div className="bg-fill-background-primary rounded-lg shadow-md p-6 border border-line">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-body-small font-medium text-text-secondary">{title}</p>
          <p className="font-h4 text-text-title mt-2">{value}</p>
          {subtitle && (
            <p className="font-body-x-small text-text-secondary mt-1">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="text-fill-accent-3">{icon}</div>
        )}
      </div>
    </div>
  );
}

