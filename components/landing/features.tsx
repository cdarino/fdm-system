import { Card } from '@/components/ui/card';
import { Home, Briefcase, Target } from 'lucide-react';

const features = [
  {
    icon: Home,
    title: 'Conflict Features',
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod.',
  },
  {
    icon: Briefcase,
    title: 'Business Features',
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod.',
  },
  {
    icon: Target,
    title: 'Complete Solution',
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod.',
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="w-full bg-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Feature Cards Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title} className="p-6 bg-white border-[#E2E7EC] rounded-xl hover:shadow-md transition-shadow">
                <div className="space-y-4">
                  {/* Icon Background */}
                  <div className="w-12 h-12 bg-[#E2F4FA] rounded-full flex items-center justify-center">
                    <Icon className="w-6 h-6 text-[#5BC4E7]" />
                  </div>

                  {/* Content */}
                  <div className="space-y-2">
                    <h3 className="text-base font-semibold text-[#1A1D20]">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-[#6C7E8E] leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
