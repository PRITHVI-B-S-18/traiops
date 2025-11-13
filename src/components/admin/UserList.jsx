import React, { useState } from 'react';
import UserCard from './UserCard';
import EditUserModal from './EditUserModal';
import { Loader2, Users as UsersIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const UserList = ({ users, loading, onRefresh }) => {
  const [editingUser, setEditingUser] = useState(null);

  const handleEdit = (user) => {
    setEditingUser(user);
  };

  const handleEditClose = () => {
    setEditingUser(null);
    onRefresh();
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-[#E0E0E0] shadow-sm p-12 flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#5A5A5A] mb-4" />
        <p className="text-sm text-[#666666]">Loading users...</p>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-[#E0E0E0] shadow-sm p-12 flex flex-col items-center justify-center">
        <UsersIcon className="h-12 w-12 text-[#D0D0D0] mb-4" />
        <p className="text-lg font-semibold text-[#2C2C2C] mb-2">No users found</p>
        <p className="text-sm text-[#666666]">Invite users to get started</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg border border-[#E0E0E0] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E0E0E0]">
          <h3 className="font-semibold text-[#2C2C2C]">
            All Users <span className="text-[#666666] font-normal">({users.length})</span>
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
          <AnimatePresence>
            {users.map((user) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <UserCard 
                  user={user} 
                  onEdit={handleEdit}
                  onRefresh={onRefresh}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={handleEditClose}
        />
      )}
    </>
  );
};

export default UserList;

