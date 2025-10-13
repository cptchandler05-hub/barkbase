import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import type { RescueNeed } from '@/types/partners';

const priorityConfig = {
  1: { label: 'Urgent', icon: AlertCircle, color: 'text-red-600 bg-red-50 border-red-200' },
  2: { label: 'High', icon: AlertTriangle, color: 'text-orange-600 bg-orange-50 border-orange-200' },
  3: { label: 'Ongoing', icon: Info, color: 'text-blue-600 bg-blue-50 border-blue-200' },
};

export function PartnerNeeds({ needs }: { needs: RescueNeed[] }) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
      <h2 className="text-2xl font-bold text-blue-900 mb-6">Current Needs</h2>

      {needs.length > 0 ? (
        <div className="space-y-4">
          {needs.map((need) => {
            const config = priorityConfig[need.priority];
            const Icon = config.icon;

            return (
              <div
                key={need.id}
                className={`border-l-4 p-4 rounded-r-lg ${config.color}`}
              >
                <div className="flex items-start gap-3">
                  <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-bold text-gray-900">{need.title}</h3>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white">
                        {config.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{need.body}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
          <p className="text-sm text-blue-800">
            <strong>Ongoing needs:</strong> Fosters, transport, heartworm care, and general support.
          </p>
        </div>
      )}
    </div>
  );
}
