'use client';

import { Card } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const data = [
  { month: 'Jan', data: 40, visualization: 24 },
  { month: 'Feb', data: 50, visualization: 35 },
  { month: 'Mar', data: 65, visualization: 45 },
  { month: 'Apr', data: 55, visualization: 42 },
  { month: 'May', data: 75, visualization: 60 },
];

export function ProjectsBarChart() {
  return (
    <Card padding="default">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
          <YAxis stroke="var(--muted-foreground)" fontSize={12} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
            }}
          />
          <Legend />
          <Bar dataKey="data" fill="var(--primary)" radius={[8, 8, 0, 0]} />
          <Bar dataKey="visualization" fill="var(--secondary)" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
