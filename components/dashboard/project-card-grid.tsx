'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Project {
  id: string;
  name: string;
  type: string;
  units: string;
  status: 'active' | 'pending' | 'completed' | 'on-hold';
}

const projects: Project[] = [
  {
    id: '1',
    name: 'First Davao Property',
    type: 'Property Inc.',
    units: '16 Units • 54 Homes',
    status: 'active',
  },
  {
    id: '2',
    name: 'First Davao Utilities Hille',
    type: 'Property Inc.',
    units: '12 Units • 44 Homes',
    status: 'active',
  },
  {
    id: '3',
    name: 'First Davao Millennium...',
    type: 'Property Inc.',
    units: '16 Units • 54 Homes',
    status: 'completed',
  },
];

const statusConfig = {
  active: { label: 'Active', bg: '#E2F4FA', text: '#5BC4E7' },
  pending: { label: 'Pending', bg: '#FFF9E5', text: '#F5CE42' },
  completed: { label: 'Completed', bg: '#E8F5E9', text: '#4CAF50' },
  'on-hold': { label: 'On Hold', bg: '#FCE4EC', text: '#E91E63' },
};

export function ProjectCardGrid() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-[#1A1D20]">Project Listings</h3>
        <a href="#" className="text-[#5BC4E7] text-sm hover:underline">
          View all
        </a>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {projects.map((project) => {
          const status = statusConfig[project.status];
          return (
            <Card
              key={project.id}
              className="overflow-hidden bg-white border-[#E2E7EC] hover:shadow-lg transition-shadow rounded-xl group cursor-pointer"
            >
              {/* Image Placeholder */}
              <div className="w-full h-40 bg-gradient-to-br from-blue-300 to-blue-200 relative">
                <div className="absolute inset-0 flex items-center justify-center text-white font-semibold opacity-50">
                  Property Image
                </div>
              </div>

              {/* Content */}
              <div className="p-4 space-y-3">
                {/* Title */}
                <div>
                  <h4 className="font-semibold text-[#1A1D20] text-sm group-hover:text-[#5BC4E7] transition-colors">
                    {project.name}
                  </h4>
                  <p className="text-xs text-[#6C7E8E] mt-1">
                    {project.type}
                  </p>
                </div>

                {/* Status Badge */}
                <Badge
                  className="w-fit rounded text-xs"
                  style={{
                    backgroundColor: status.bg,
                    color: status.text,
                    border: `1px solid ${status.text}`,
                  }}
                >
                  {status.label}
                </Badge>

                {/* Units */}
                <p className="text-xs text-[#6C7E8E]">
                  {project.units}
                </p>
              </div>
            </Card>
          );
        })}
        
        {/* Add New Project Card */}
        <Card className="border-2 border-dashed border-[#E2E7EC] rounded-xl hover:border-[#5BC4E7] transition-colors bg-white flex items-center justify-center min-h-64">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-[#E2F4FA] rounded-lg mx-auto flex items-center justify-center">
              <span className="text-2xl text-[#5BC4E7]">+</span>
            </div>
            <p className="text-sm text-[#6C7E8E]">Available projects<br/>coming soon</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
