import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Edit2, Trash2, Users, Building2, Check, X, Search, AlertTriangle, Loader2 } from 'lucide-react';
import { 
  getAllClients, 
  createClient, 
  updateClient, 
  deleteClient,
  assignPMToClient,
  removePMFromClient,
  prePopulateClients
} from '../../utils/firestoreClients';
import { getUsersByRole } from '../../utils/firestoreUsers';
import { useToast } from '@/components/ui/use-toast';
import { useDebounce } from '@/hooks/useDebounce';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FormInput } from '@/components/ui/form-input';
import { cn } from '@/lib/utils';
import { cardStyles, cardPadding, getChipClasses } from '@/styles/designSystem';
import { LoadingSkeleton } from '@/components/ui/loading-skeletons';

export default function ClientManagementPage() {
  const { setCommandState } = useOutletContext();
  const { toast } = useToast();
  const [clients, setClients] = useState([]);
  const [programManagers, setProgramManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignPMModal, setShowAssignPMModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRemovePMConfirm, setShowRemovePMConfirm] = useState(false);
  const [showPrePopulateConfirm, setShowPrePopulateConfirm] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [removePMTarget, setRemovePMTarget] = useState({ clientId: null, pmId: null });
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'active'
  });
  const [isPrePopulating, setIsPrePopulating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [formErrors, setFormErrors] = useState({
    name: '',
    description: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const clientsWithPMs = clients.filter(c => 
      c.programManagerIds && c.programManagerIds.length > 0 && c.status === 'active'
    );
    const clientsWithoutPMs = clients.filter(c => 
      (!c.programManagerIds || c.programManagerIds.length === 0) && c.status === 'active'
    );
    const totalActive = clients.filter(c => c.status === 'active').length;

    setCommandState({
      title: 'Client Management',
      description: 'Manage clients and assign Program Managers to oversee their training programs.',
      actions: (
        <>
          {clients.length === 0 && (
            <Button
              onClick={() => setShowPrePopulateConfirm(true)}
              disabled={isPrePopulating}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 whitespace-nowrap"
            >
              {isPrePopulating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Pre-populate 10 Clients'
              )}
            </Button>
          )}
          <Button
            onClick={() => setShowAddModal(true)}
            size="sm"
            className="flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            Add Client
          </Button>
        </>
      ),
      metrics: [
        <div key="total" className={cn(cardStyles.surface, cardPadding)}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Total Clients</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{totalActive}</p>
            </div>
            <Building2 className="h-8 w-8 text-indigo-600" />
          </div>
        </div>,
        <div key="with-pms" className={cn(cardStyles.surface, cardPadding)}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">With PMs Assigned</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{clientsWithPMs.length}</p>
            </div>
            <Check className="h-8 w-8 text-emerald-600" />
          </div>
        </div>,
        <div key="without-pms" className={cn(cardStyles.surface, cardPadding)}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Without PMs</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{clientsWithoutPMs.length}</p>
            </div>
            <Users className="h-8 w-8 text-amber-600" />
          </div>
        </div>,
      ],
    });
  }, [clients, isPrePopulating, setCommandState]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [clientsData, pmsData] = await Promise.all([
        getAllClients(),
        getUsersByRole('program_manager')
      ]);
      setClients(clientsData);
      setProgramManagers(pmsData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setLoading(false);
  };

  const handlePrePopulate = async () => {
    setIsPrePopulating(true);
    setShowPrePopulateConfirm(false);
    try {
    const result = await prePopulateClients();
    if (result.success) {
        toast({
          title: 'Clients created',
          description: `Successfully created ${result.created} default clients.`,
        });
      await loadData();
    } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to create clients',
          variant: 'destructive',
        });
    }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred while creating clients.',
        variant: 'destructive',
      });
    } finally {
    setIsPrePopulating(false);
    }
  };

  const validateForm = () => {
    const errors = { name: '', description: '' };
    let isValid = true;

    if (!formData.name.trim()) {
      errors.name = 'Client name is required';
      isValid = false;
    } else if (formData.name.trim().length < 2) {
      errors.name = 'Client name must be at least 2 characters';
      isValid = false;
    }

    setFormErrors(errors);
    return isValid;
  };

  const handleAddClient = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsProcessing(true);
    try {
    const result = await createClient({
      ...formData,
      programManagerIds: []
    });

    if (result.success) {
        toast({
          title: 'Client created',
          description: `${formData.name} has been added successfully.`,
        });
      await loadData();
      setShowAddModal(false);
      setFormData({ name: '', description: '', status: 'active' });
      setFormErrors({ name: '', description: '' });
    } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to create client',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditClient = async (e) => {
    e.preventDefault();
    if (!selectedClient) return;
    setIsProcessing(true);
    try {
    const result = await updateClient(selectedClient.clientId, formData);
    if (result.success) {
        toast({
          title: 'Client updated',
          description: `${formData.name} has been updated successfully.`,
        });
      await loadData();
      setShowEditModal(false);
      setSelectedClient(null);
      setFormData({ name: '', description: '', status: 'active' });
      setFormErrors({ name: '', description: '' });
    } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to update client',
          variant: 'destructive',
        });
    }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteClient = (clientId) => {
    setDeleteTarget(clientId);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteClient = async () => {
    if (!deleteTarget) return;
    setIsProcessing(true);
    setShowDeleteConfirm(false);
    
    // Store client data for potential undo
    const deletedClient = clients.find(c => c.clientId === deleteTarget);
    const clientName = deletedClient?.name || 'Client';
    
    try {
      const result = await deleteClient(deleteTarget);
    if (result.success) {
        toast({
          title: 'Client deleted',
          description: `${clientName} has been soft-deleted successfully.`,
          actionLabel: 'Undo',
          onAction: async () => {
            // Note: This would require a restore function in firestoreClients
            // For now, we'll show a message that undo is not yet implemented
            toast({
              title: 'Undo not available',
              description: 'Please restore the client manually if needed.',
              variant: 'default',
            });
          },
        });
      await loadData();
    } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to delete client',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setDeleteTarget(null);
    }
  };

  const handleAssignPM = async (pmId) => {
    if (!selectedClient) return;
    setIsProcessing(true);
    try {
    const result = await assignPMToClient(selectedClient.clientId, pmId);
    if (result.success) {
        const pmName = getPMName(pmId);
        toast({
          title: 'Program Manager assigned',
          description: `${pmName} has been assigned to ${selectedClient.name}.`,
        });
      await loadData();
      setShowAssignPMModal(false);
      setSelectedClient(null);
    } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to assign Program Manager',
          variant: 'destructive',
        });
    }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemovePM = (clientId, pmId) => {
    setRemovePMTarget({ clientId, pmId });
    setShowRemovePMConfirm(true);
  };

  const confirmRemovePM = async () => {
    if (!removePMTarget.clientId || !removePMTarget.pmId) return;
    setIsProcessing(true);
    setShowRemovePMConfirm(false);
    try {
      const result = await removePMFromClient(removePMTarget.clientId, removePMTarget.pmId);
    if (result.success) {
        const pmName = getPMName(removePMTarget.pmId);
        const clientName = clients.find(c => c.clientId === removePMTarget.clientId)?.name || 'client';
        toast({
          title: 'Program Manager removed',
          description: `${pmName} has been removed from ${clientName}.`,
        });
      await loadData();
    } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to remove Program Manager',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setRemovePMTarget({ clientId: null, pmId: null });
    }
  };

  const openEditModal = (client) => {
    setSelectedClient(client);
    setFormData({
      name: client.name,
      description: client.description || '',
      status: client.status || 'active'
    });
    setShowEditModal(true);
  };

  const openAssignPMModal = (client) => {
    setSelectedClient(client);
    setShowAssignPMModal(true);
  };

  const getPMName = (pmId) => {
    // programManagers come from getUsersByRole which returns objects with 'id' (doc ID) or 'uid'
    const pm = programManagers.find(p => (p.uid || p.id) === pmId);
    return pm ? (pm.displayName || pm.name || pm.email?.split('@')[0] || 'Unknown PM') : 'Unknown PM';
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) &&
    client.status === 'active'
  );

  // Group clients by having PMs or not
  const clientsWithPMs = filteredClients.filter(c => 
    c.programManagerIds && c.programManagerIds.length > 0
  );
  const clientsWithoutPMs = filteredClients.filter(c => 
    !c.programManagerIds || c.programManagerIds.length === 0
  );

  if (loading) {
    return <LoadingSkeleton message="Loading clients..." />;
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          placeholder="Search clients..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-400 focus:border-transparent bg-white shadow-sm"
        />
      </div>

      {/* Clients with PMs */}
      {clientsWithPMs.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-foreground mb-2">Clients with Program Managers</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {clientsWithPMs.map(client => (
              <ClientCard
                key={client.clientId}
                client={client}
                programManagers={programManagers}
                getPMName={getPMName}
                onEdit={openEditModal}
                onDelete={handleDeleteClient}
                onAssignPM={openAssignPMModal}
                onRemovePM={handleRemovePM}
              />
            ))}
          </div>
        </div>
      )}

      {/* Clients without PMs */}
      {clientsWithoutPMs.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-foreground mb-2">Clients without Program Managers</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {clientsWithoutPMs.map(client => (
              <ClientCard
                key={client.clientId}
                client={client}
                programManagers={programManagers}
                getPMName={getPMName}
                onEdit={openEditModal}
                onDelete={handleDeleteClient}
                onAssignPM={openAssignPMModal}
                onRemovePM={handleRemovePM}
              />
            ))}
          </div>
        </div>
      )}

      {filteredClients.length === 0 && clients.length === 0 && (
        <div className={cn(cardStyles.surface, 'p-12 text-center')}>
          <Building2 className="mx-auto text-slate-300 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No clients yet</h3>
          <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
            Get started by adding your first client organization. You can assign Program Managers to oversee their training programs.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Client
            </Button>
            <Button 
              onClick={() => setShowPrePopulateConfirm(true)} 
              variant="outline" 
              isLoading={isPrePopulating}
              loadingText="Creating..."
            >
              Pre-populate 10 Clients
            </Button>
          </div>
        </div>
      )}

      {filteredClients.length === 0 && clients.length > 0 && (
        <div className={cn(cardStyles.surface, 'p-12 text-center')}>
          <Search className="mx-auto text-slate-300 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No clients found</h3>
          <p className="text-sm text-slate-500 mb-4">
            No clients match your search. Try adjusting your search term.
          </p>
          <Button onClick={() => setSearchTerm('')} variant="outline" size="sm">
            Clear search
          </Button>
        </div>
      )}

      {/* Add Client Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
            <DialogDescription>
              Create a new client organization. You can assign Program Managers later.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddClient} className="space-y-4">
            <FormInput
              label="Client Name"
              required
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value });
                if (formErrors.name) {
                  setFormErrors({ ...formErrors, name: '' });
                }
              }}
              placeholder="e.g., ABC University"
              disabled={isProcessing}
              error={formErrors.name}
              helperText="Enter the name of the client organization"
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows="3"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-400 focus:border-transparent resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Optional description"
                disabled={isProcessing}
              />
              <p className="text-xs text-slate-500">Optional description for the client organization</p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddModal(false);
                  setFormData({ name: '', description: '', status: 'active' });
                }}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={isProcessing} loadingText="Creating...">
                Add Client
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Client Modal */}
      <Dialog open={showEditModal} onOpenChange={(open) => {
        if (!open) {
            setShowEditModal(false);
            setSelectedClient(null);
            setFormData({ name: '', description: '', status: 'active' });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
            <DialogDescription>
              Update client information. Changes will be saved immediately.
            </DialogDescription>
          </DialogHeader>
          {selectedClient && (
            <form onSubmit={handleEditClient} className="space-y-4">
            <FormInput
              label="Client Name"
              required
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value });
                if (formErrors.name) {
                  setFormErrors({ ...formErrors, name: '' });
                }
              }}
              placeholder="e.g., ABC University"
              disabled={isProcessing}
              error={formErrors.name}
              helperText="Enter the name of the client organization"
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows="3"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-400 focus:border-transparent resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Optional description"
                disabled={isProcessing}
              />
              <p className="text-xs text-slate-500">Optional description for the client organization</p>
            </div>
              <DialogFooter>
                <Button
                type="button"
                  variant="outline"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedClient(null);
                    setFormData({ name: '', description: '', status: 'active' });
                    setFormErrors({ name: '', description: '' });
                  }}
                  disabled={isProcessing}
              >
                Cancel
                </Button>
                <Button type="submit" isLoading={isProcessing} loadingText="Saving...">
                  Save Changes
                </Button>
              </DialogFooter>
          </form>
      )}
        </DialogContent>
      </Dialog>

      {/* Assign PM Modal */}
      <Dialog open={showAssignPMModal} onOpenChange={(open) => {
        if (!open) {
            setShowAssignPMModal(false);
            setSelectedClient(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Program Manager</DialogTitle>
            <DialogDescription>
              {selectedClient && `Select a Program Manager to assign to ${selectedClient.name}.`}
            </DialogDescription>
          </DialogHeader>
          {selectedClient && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
            {programManagers.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">No Program Managers available</p>
            ) : (
              programManagers
                .filter(pm => {
                  const pmId = pm.uid || pm.id;
                  return !selectedClient.programManagerIds?.includes(pmId);
                })
                .map(pm => {
                  const pmId = pm.uid || pm.id;
                  const pmName = pm.displayName || pm.name || pm.email?.split('@')[0] || 'Unknown';
                  return (
                    <button
                      key={pmId}
                      onClick={() => handleAssignPM(pmId)}
                        disabled={isProcessing}
                        className="w-full text-left px-3 py-2.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <div className="font-medium text-slate-900">{pmName}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{pm.email || ''}</div>
                    </button>
                  );
                })
            )}
            {programManagers.filter(pm => {
              const pmId = pm.uid || pm.id;
              return !selectedClient.programManagerIds?.includes(pmId);
            }).length === 0 && programManagers.length > 0 && (
                <p className="text-sm text-slate-500 text-center py-6">All Program Managers are already assigned</p>
            )}
          </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
              Delete Client
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this client? This will soft-delete the client and it can be restored later if needed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteConfirm(false);
                setDeleteTarget(null);
              }}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteClient}
              isLoading={isProcessing}
              loadingText="Deleting..."
            >
              Delete Client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove PM Confirmation Dialog */}
      <Dialog open={showRemovePMConfirm} onOpenChange={setShowRemovePMConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Program Manager</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this Program Manager from the client? They will no longer have access to manage this client's training programs.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRemovePMConfirm(false);
                setRemovePMTarget({ clientId: null, pmId: null });
              }}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmRemovePM}
              isLoading={isProcessing}
              loadingText="Removing..."
            >
              Remove Program Manager
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pre-populate Confirmation Dialog */}
      <Dialog open={showPrePopulateConfirm} onOpenChange={setShowPrePopulateConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pre-populate Clients</DialogTitle>
            <DialogDescription>
              This will create 10 default client organizations. This is useful for testing or getting started quickly. You can edit or delete them later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPrePopulateConfirm(false)}
              disabled={isPrePopulating}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePrePopulate}
              disabled={isPrePopulating}
            >
              {isPrePopulating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create 10 Clients'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Client Card Component
function ClientCard({ client, programManagers, getPMName, onEdit, onDelete, onAssignPM, onRemovePM }) {
  const assignedPMs = client.programManagerIds || [];

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200 p-3">
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground truncate">{client.name}</h3>
              {client.description && (
                <p className="text-muted-foreground text-xs mt-0.5 line-clamp-1">{client.description}</p>
              )}
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button
                onClick={() => onEdit(client)}
                className="p-1.5 text-muted-foreground hover:bg-background rounded transition-colors"
                title="Edit"
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={() => onDelete(client.clientId)}
                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 mt-2 pt-2">
        <div className="flex justify-between items-center mb-2">
          <h4 className="text-xs font-medium text-foreground">
            Program Managers ({assignedPMs.length})
          </h4>
          <button
            onClick={() => onAssignPM(client)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded border border-indigo-200 transition-colors"
          >
            <Plus size={12} />
            Assign PM
          </button>
        </div>

        {assignedPMs.length > 0 ? (
          <div className="space-y-1">
            {assignedPMs.map(pmId => (
              <div
                key={pmId}
                className="flex justify-between items-center px-2 py-1 bg-background rounded text-xs"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Users size={12} className="text-muted-foreground flex-shrink-0" />
                  <span className="text-foreground truncate">{getPMName(pmId)}</span>
                </div>
                <button
                  onClick={() => onRemovePM(client.clientId, pmId)}
                  className="p-0.5 text-red-600 hover:bg-red-50 rounded transition-colors flex-shrink-0 ml-2"
                  title="Remove"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-xs italic">No Program Managers assigned yet</p>
        )}
      </div>
    </div>
  );
}


