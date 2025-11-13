import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useOutletContext } from 'react-router-dom';
import { subscribeToScheduleUpdates } from '../../utils/firestoreSchedule';
import { getClientsByPM } from '../../utils/firestoreClients';
import { loadTrainerData } from '../../utils/firestoreTrainers';
import { Users, Building2, Search, Mail, Phone, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { LoadingSkeleton } from '@/components/ui/loading-skeletons';
import { cn } from '@/lib/utils';
import { cardStyles, cardPadding } from '@/styles/designSystem';

export default function MyTrainersPage() {
  const { user } = useAuth();
  const { setCommandState, resetCommandState } = useOutletContext();
  const [clients, setClients] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [scheduleData, setScheduleData] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [expandedClients, setExpandedClients] = useState(new Set());

  // Load clients and trainers (one-time, then subscribe to schedule updates)
  useEffect(() => {
    if (!user?.uid) return;

    let isMounted = true;

    const loadInitialData = async () => {
      setLoading(true);
      try {
        const [clientsData, trainersData] = await Promise.all([
          getClientsByPM(user.uid),
          loadTrainerData()
        ]);
        
        if (!isMounted) return;
        
        setClients(clientsData.filter(c => c.status === 'active'));
        setTrainers(trainersData || []);
        
        // Auto-expand all clients initially
        setExpandedClients(new Set(clientsData.map(c => c.clientId)));
        setLoading(false);
      } catch (error) {
        console.error('Error loading initial data:', error);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadInitialData();

    // Subscribe to real-time schedule updates
    const unsubscribe = subscribeToScheduleUpdates((schedule) => {
      if (!isMounted) return;
      setScheduleData(schedule || {});
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [user?.uid]);

  const toggleClientExpansion = (clientId) => {
    setExpandedClients(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clientId)) {
        newSet.delete(clientId);
      } else {
        newSet.add(clientId);
      }
      return newSet;
    });
  };

  // Group trainers by client based on actual scheduled tasks
  const trainersByClient = useMemo(() => {
    if (!user?.uid || !scheduleData || Object.keys(scheduleData).length === 0) {
      return {};
    }

    const grouped = {};
    const pmId = user.uid;

    // Iterate through all dates in schedule
    Object.values(scheduleData).forEach(tasks => {
      if (!Array.isArray(tasks)) return;

      tasks.forEach(task => {
        // Only process training tasks (they have clients and assignedPMIds)
        if (task.type === 'training' && task.client && task.clientId && task.assignedPMIds) {
          // Check if this PM is assigned to this task
          const isPMAssigned = task.assignedPMIds.includes(pmId);
          
          if (isPMAssigned) {
            const clientId = task.clientId;
            const trainerName = task.trainer;

            // Find trainer details
            const trainer = trainers.find(t => t.name === trainerName);
            
            if (trainer) {
              if (!grouped[clientId]) {
                grouped[clientId] = [];
              }

              // Check if this trainer is already added for this client
              const existingTrainer = grouped[clientId].find(
                t => t.trainerId === trainer.id || t.trainerName === trainerName
              );

              if (!existingTrainer) {
                grouped[clientId].push({
                  trainerId: trainer.id,
                  trainerName: trainer.name,
                  trainerEmail: trainer.email || ''
                });
              }
            }
          }
        }
      });
    });

    return grouped;
  }, [scheduleData, trainers, user?.uid]);

  const filteredClients = useMemo(() => {
    if (!debouncedSearchTerm) return clients;

    const term = debouncedSearchTerm.toLowerCase();
    return clients.filter(client => {
      // Search in client name
      if (client.name.toLowerCase().includes(term)) return true;

      // Search in trainer names
      const trainers = trainersByClient[client.clientId] || [];
      return trainers.some(trainer =>
        trainer.trainerName?.toLowerCase().includes(term) ||
        trainer.trainerEmail?.toLowerCase().includes(term)
      );
    });
  }, [clients, debouncedSearchTerm, trainersByClient]);

  const totalTrainers = useMemo(() => {
    const uniqueTrainers = new Set();
    Object.values(trainersByClient).forEach(trainerList => {
      trainerList.forEach(trainer => {
        uniqueTrainers.add(trainer.trainerId || trainer.trainerName);
      });
    });
    return uniqueTrainers.size;
  }, [trainersByClient]);

  const totalTasks = useMemo(() => {
    if (!user?.uid || !scheduleData) return 0;
    
    const pmId = user.uid;
    let count = 0;
    
    Object.values(scheduleData).forEach(tasks => {
      if (Array.isArray(tasks)) {
        tasks.forEach(task => {
          if (task.assignedPMIds && task.assignedPMIds.includes(pmId)) {
            count++;
          }
        });
      }
    });
    
    return count;
  }, [scheduleData, user?.uid]);

  // Set command state for this page - title immediately, metrics when data loads
  useEffect(() => {
    if (setCommandState) {
      setCommandState({
        title: 'My Trainers',
        description: 'View trainers with scheduled tasks where you are assigned as Program Manager.',
        metrics: !loading ? [
          <div key="clients" className={cn(cardStyles.surface, cardPadding)}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">My Clients</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{clients.length}</p>
              </div>
              <Building2 className="h-8 w-8 text-indigo-600" />
            </div>
          </div>,
          <div key="trainers" className={cn(cardStyles.surface, cardPadding)}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Total Trainers</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{totalTrainers}</p>
              </div>
              <Users className="h-8 w-8 text-emerald-600" />
            </div>
          </div>,
          <div key="tasks" className={cn(cardStyles.surface, cardPadding)}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Total Tasks</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{totalTasks}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </div>,
        ] : null,
      });
    }
    return () => {
      if (resetCommandState) {
        resetCommandState();
      }
    };
  }, [clients.length, totalTrainers, totalTasks, loading, setCommandState, resetCommandState]);

  if (loading) {
    return <LoadingSkeleton message="Loading trainers..." className="h-64" />;
  }

  return (
    <div className="space-y-6">
      {/* Header and Stats removed - now in command ribbon */}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search clients or trainers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      {/* Clients List */}
      {filteredClients.length > 0 ? (
        <div className="space-y-4">
          {filteredClients.map(client => {
            const clientTrainers = trainersByClient[client.clientId] || [];
            const isExpanded = expandedClients.has(client.clientId);

            return (
              <div key={client.clientId} className="bg-white rounded-lg shadow-sm border border-gray-200">
                {/* Client Header */}
                <button
                  onClick={() => toggleClientExpansion(client.clientId)}
                  className="w-full px-6 py-4 flex justify-between items-center hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <Building2 className="text-indigo-600" size={24} />
                    <div className="text-left">
                      <h3 className="text-lg font-semibold text-gray-900">{client.name}</h3>
                      <p className="text-sm text-gray-600">
                        {clientTrainers.length} trainer{clientTrainers.length !== 1 ? 's' : ''} with scheduled tasks
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </button>

                {/* Trainers List (Expandable) */}
                {isExpanded && (
                  <div className="px-6 pb-4 border-t border-gray-200">
                    {clientTrainers.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        {clientTrainers.map(trainer => (
                          <TrainerCard key={trainer.trainerId} trainer={trainer} />
                        ))}
                      </div>
                    ) : (
                      <div className="py-8 text-center text-gray-500">
                        <Users className="mx-auto mb-2" size={32} />
                        <p className="text-sm">No trainers with scheduled tasks for this client</p>
                        <p className="text-xs text-gray-400 mt-1">Trainers will appear here when tasks are scheduled with you as PM</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Building2 className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {clients.length === 0 ? 'No clients assigned' : totalTrainers === 0 ? 'No trainers found' : 'No results found'}
          </h3>
          <p className="text-gray-600">
            {clients.length === 0
              ? 'You have not been assigned to any clients yet'
              : totalTrainers === 0
              ? 'No trainers with scheduled tasks yet. Trainers will appear here when tasks are scheduled with you as Program Manager.'
              : 'Try a different search term'
            }
          </p>
        </div>
      )}
    </div>
  );
}

// Trainer Card Component
function TrainerCard({ trainer }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-indigo-100 rounded-lg">
          <Users className="text-indigo-600" size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 truncate">{trainer.trainerName}</h4>
          <div className="mt-1 space-y-1">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Mail size={14} />
              <span className="truncate">{trainer.trainerEmail}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
