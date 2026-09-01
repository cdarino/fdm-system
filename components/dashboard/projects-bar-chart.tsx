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
    <Card className="p-6 bg-white border-[#E2E7EC] rounded-xl">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E7EC" vertical={false} />
          <XAxis dataKey="month" stroke="#6C7E8E" fontSize={12} />
          <YAxis stroke="#6C7E8E" fontSize={12} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E7EC',
              borderRadius: '8px',
            }}
          />
          <Legend />
          <Bar dataKey="data" fill="#5BC4E7" radius={[8, 8, 0, 0]} />
          <Bar dataKey="visualization" fill="#F5CE42" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
