import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, Plus, Edit, Trash2, X, Save, Map } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import {
  getAllLocations,
  createLocation,
  updateLocation,
  deleteLocation,
} from '../../utils/firestoreLocations';
import { getProgramManagers } from '../../utils/firestoreUsers';

const LocationManagementPage = () => {
  const [locations, setLocations] = useState([]);
  const [programManagers, setProgramManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    coordinates: {
      lat: '',
      lng: '',
    },
    radius: 100,
    clientName: '',
    programManagerIds: [],
    status: 'active',
  });
  const { toast } = useToast();

  // Fetch locations and program managers
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [locationsData, pmsData] = await Promise.all([
        getAllLocations(),
        getProgramManagers(),
      ]);
      setLocations(locationsData);
      setProgramManagers(pmsData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load locations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'lat' || name === 'lng') {
      setFormData({
        ...formData,
        coordinates: {
          ...formData.coordinates,
          [name]: parseFloat(value) || '',
        },
      });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleProgramManagerToggle = (pmId) => {
    const currentIds = formData.programManagerIds || [];
    if (currentIds.includes(pmId)) {
      setFormData({
        ...formData,
        programManagerIds: currentIds.filter((id) => id !== pmId),
      });
    } else {
      setFormData({
        ...formData,
        programManagerIds: [...currentIds, pmId],
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      coordinates: {
        lat: '',
        lng: '',
      },
      radius: 100,
      clientName: '',
      programManagerIds: [],
      status: 'active',
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.name || !formData.address || !formData.coordinates.lat || !formData.coordinates.lng) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      if (editingId) {
        await updateLocation(editingId, formData);
        toast({
          title: 'Success',
          description: 'Location updated successfully',
        });
      } else {
        await createLocation(formData);
        toast({
          title: 'Success',
          description: 'Location created successfully',
        });
      }
      await fetchData();
      resetForm();
    } catch (error) {
      console.error('Error saving location:', error);
      toast({
        title: 'Error',
        description: 'Failed to save location',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (location) => {
    setFormData({
      name: location.name,
      address: location.address,
      coordinates: location.coordinates,
      radius: location.radius || 100,
      clientName: location.clientName || '',
      programManagerIds: location.programManagerIds || [],
      status: location.status,
    });
    setEditingId(location.locationId);
    setShowForm(true);
  };

  const handleDelete = async (locationId) => {
    if (!window.confirm('Are you sure you want to delete this location?')) {
      return;
    }

    setLoading(true);
    try {
      await deleteLocation(locationId);
      toast({
        title: 'Success',
        description: 'Location deleted successfully',
      });
      await fetchData();
    } catch (error) {
      console.error('Error deleting location:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete location',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#2C2C2C] mb-2">
              Location Management
            </h1>
            <p className="text-[#666666]">
              Manage client locations and assign Program Managers
            </p>
          </div>
          {!showForm && (
            <Button
              onClick={() => setShowForm(true)}
              className="bg-gradient-to-r from-[#5A5A5A] to-[#3D3D3D] text-white hover:from-[#4A4A4A] hover:to-[#2C2C2C]"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Location
            </Button>
          )}
        </div>
      </motion.div>

      {/* Form */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white border border-[#E0E0E0] rounded-lg p-6 mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-[#2C2C2C]">
              {editingId ? 'Edit Location' : 'Add New Location'}
            </h2>
            <button
              onClick={resetForm}
              className="p-2 hover:bg-[#F5F5F5] rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-[#666666]" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#2C2C2C] mb-1">
                  Location Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-[#D0D0D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A5A]"
                  placeholder="Main Office"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#2C2C2C] mb-1">
                  Client Name
                </label>
                <input
                  type="text"
                  name="clientName"
                  value={formData.clientName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-[#D0D0D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A5A]"
                  placeholder="Client ABC"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#2C2C2C] mb-1">
                Address <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-[#D0D0D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A5A]"
                placeholder="123 Main St, City, State"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#2C2C2C] mb-1">
                  Latitude <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="lat"
                  step="any"
                  value={formData.coordinates.lat}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-[#D0D0D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A5A]"
                  placeholder="37.7749"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#2C2C2C] mb-1">
                  Longitude <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="lng"
                  step="any"
                  value={formData.coordinates.lng}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-[#D0D0D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A5A]"
                  placeholder="-122.4194"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#2C2C2C] mb-1">
                  Radius (meters)
                </label>
                <input
                  type="number"
                  name="radius"
                  value={formData.radius}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-[#D0D0D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A5A]"
                  placeholder="100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
                Assign Program Managers
              </label>
              <div className="border border-[#D0D0D0] rounded-lg p-3 max-h-40 overflow-y-auto">
                {programManagers.length === 0 ? (
                  <p className="text-sm text-[#888888]">No Program Managers available</p>
                ) : (
                  programManagers.map((pm) => (
                    <label key={pm.uid} className="flex items-center space-x-2 py-2 hover:bg-[#F5F5F5] px-2 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.programManagerIds.includes(pm.uid)}
                        onChange={() => handleProgramManagerToggle(pm.uid)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-[#2C2C2C]">
                        {pm.displayName || pm.email}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#2C2C2C] mb-1">
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-[#D0D0D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A5A]"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={loading}
                className="bg-gradient-to-r from-[#5A5A5A] to-[#3D3D3D] text-white hover:from-[#4A4A4A] hover:to-[#2C2C2C]"
              >
                <Save className="h-4 w-4 mr-2" />
                {editingId ? 'Update Location' : 'Create Location'}
              </Button>
              <Button
                type="button"
                onClick={resetForm}
                variant="outline"
                className="border-[#D0D0D0] text-[#666666] hover:bg-[#F5F5F5]"
              >
                Cancel
              </Button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Locations List */}
      <div className="space-y-4">
        {loading && locations.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#888888]">Loading locations...</p>
          </div>
        ) : locations.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white border border-[#E0E0E0] rounded-lg p-12 text-center"
          >
            <MapPin className="h-16 w-16 text-[#D0D0D0] mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-[#2C2C2C] mb-2">
              No Locations Yet
            </h3>
            <p className="text-[#666666]">
              Add your first location to get started
            </p>
          </motion.div>
        ) : (
          locations.map((location, index) => (
            <motion.div
              key={location.locationId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="bg-white border border-[#E0E0E0] rounded-lg p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <MapPin className="h-5 w-5 text-[#5A5A5A]" />
                    <h3 className="text-lg font-semibold text-[#2C2C2C]">
                      {location.name}
                    </h3>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        location.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {location.status}
                    </span>
                  </div>
                  <p className="text-sm text-[#666666] mb-3">{location.address}</p>
                  {location.clientName && (
                    <p className="text-sm text-[#888888] mb-2">
                      Client: <span className="font-medium">{location.clientName}</span>
                    </p>
                  )}
                  <div className="flex gap-4 text-sm text-[#888888]">
                    <span>
                      📍 {location.coordinates.lat.toFixed(4)}, {location.coordinates.lng.toFixed(4)}
                    </span>
                    <span>📏 {location.radius}m radius</span>
                    <span>
                      👥 {location.programManagerIds?.length || 0} PM(s)
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(location)}
                    className="p-2 hover:bg-[#F5F5F5] rounded-lg transition-colors"
                  >
                    <Edit className="h-4 w-4 text-[#5A5A5A]" />
                  </button>
                  <button
                    onClick={() => handleDelete(location.locationId)}
                    className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default LocationManagementPage;

