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

// Complete, unbroken class literals so Tailwind's static compiler detects them.
const statusConfig = {
  active: {
    label: 'Active',
    className: 'bg-sidebar-accent text-accent-blue-foreground border-[color-mix(in_srgb,var(--primary)_30%,white)]',
  },
  pending: {
    label: 'Pending',
    className: 'bg-chart-4 text-accent-gold-foreground border-[color-mix(in_srgb,var(--secondary)_30%,white)]',
  },
  completed: {
    label: 'Completed',
    className:
      'bg-[color-mix(in_srgb,var(--success)_10%,white)] text-success border-[color-mix(in_srgb,var(--success)_30%,white)]',
  },
  'on-hold': {
    label: 'On Hold',
    className:
      'bg-[color-mix(in_srgb,var(--destructive)_10%,white)] text-destructive border-[color-mix(in_srgb,var(--destructive)_30%,white)]',
  },
};

export function ProjectCardGrid() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-foreground">Project Listings</h3>
        <a href="#" className="text-primary text-sm hover:underline">
          View all
        </a>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {projects.map((project) => {
          const status = statusConfig[project.status];
          return (
            <Card
              key={project.id}
              className="overflow-hidden bg-card border-border hover:shadow-lg transition-shadow rounded-xl group cursor-pointer"
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
                  <h4 className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">
                    {project.name}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {project.type}
                  </p>
                </div>

                {/* Status Badge */}
                <Badge className={`w-fit rounded text-xs border ${status.className}`}>
                  {status.label}
                </Badge>

                {/* Units */}
                <p className="text-xs text-muted-foreground">
                  {project.units}
                </p>
              </div>
            </Card>
          );
        })}
        
        {/* Add New Project Card */}
        <Card className="border-2 border-dashed border-border rounded-xl hover:border-primary transition-colors bg-card flex items-center justify-center min-h-64">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-sidebar-accent rounded-lg mx-auto flex items-center justify-center">
              <span className="text-2xl text-accent-blue-foreground">+</span>
            </div>
            <p className="text-sm text-muted-foreground">Available projects<br/>coming soon</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
