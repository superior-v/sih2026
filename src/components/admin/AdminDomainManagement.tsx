import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';
import { getAllDomains, addDomain, updateDomain, deleteDomain } from '../../services/firestoreService';

interface Domain {
  id: string;
  name: string;
  url: string;
  status: 'active' | 'inactive';
  createdAt: any;
}

const AdminDomainManagement: React.FC = () => {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', url: '', status: 'active' as const });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDomains();
  }, []);

  const fetchDomains = async () => {
    setLoading(true);
    try {
      const domainsList = await getAllDomains();
      setDomains(domainsList as Domain[]);
    } catch (error) {
      console.error('Failed to fetch domains:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (editingId) {
        await updateDomain(editingId, formData);
      } else {
        await addDomain(formData.name, formData.url, formData.status);
      }
      
      setFormData({ name: '', url: '', status: 'active' });
      setIsAdding(false);
      setEditingId(null);
      fetchDomains();
    } catch (error) {
      console.error('Failed to save domain:', error);
      alert('Failed to save domain');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this domain?')) {
      try {
        await deleteDomain(id);
        fetchDomains();
      } catch (error) {
        console.error('Failed to delete domain:', error);
        alert('Failed to delete domain');
      }
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    if (timestamp.toDate) {
      return timestamp.toDate().toLocaleDateString();
    }
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Domain Management</h2>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          <span>Add Domain</span>
        </button>
      </div>

      {/* Add/Edit Form */}
      {(isAdding || editingId) && (
        <div className="bg-white rounded-lg shadow-md p-6 border-2 border-indigo-200">
          <h3 className="text-lg font-semibold mb-4">{editingId ? 'Edit Domain' : 'Add New Domain'}</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Domain Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g., Amazon India"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Domain URL</label>
              <input
                type="url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="https://example.com"
              />
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleSave}
                className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                <Save className="h-4 w-4" />
                <span>Save</span>
              </button>
              <button
                onClick={() => { setIsAdding(false); setEditingId(null); setFormData({ name: '', url: '', status: 'active' }); }}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                <X className="h-4 w-4" />
                <span>Cancel</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Domain List */}
      {loading ? (
        <div className="text-center py-8">Loading domains...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {domains.map((domain) => (
            <div key={domain.id} className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{domain.name}</h3>
                  <p className="text-sm text-gray-600 break-all">{domain.url}</p>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  domain.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {domain.status}
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-4">Created: {formatDate(domain.createdAt)}</p>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setEditingId(domain.id);
                    setFormData({ name: domain.name, url: domain.url, status: domain.status });
                  }}
                  className="flex items-center space-x-1 px-3 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                >
                  <Edit className="h-3 w-3" />
                  <span className="text-sm">Edit</span>
                </button>
                <button
                  onClick={() => handleDelete(domain.id)}
                  className="flex items-center space-x-1 px-3 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100"
                >
                  <Trash2 className="h-3 w-3" />
                  <span className="text-sm">Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminDomainManagement;