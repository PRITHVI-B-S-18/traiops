import React from 'react';
import { Button } from '@/components/ui/button';
import { 
  Mail, 
  Calendar, 
  Shield, 
  UserCheck, 
  UserCog,
  Edit,
  CheckCircle,
  XCircle
} from 'lucide-react';

const UserCard = ({ user, onEdit, onRefresh }) => {
  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin':
        return Shield;
      case 'trainer':
        return UserCheck;
      case 'program_manager':
        return UserCog;
      default:
        return Shield;
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin':
        return 'bg-[#FFE5E5] text-[#D32F2F] border-[#FF8A80]';
      case 'trainer':
        return 'bg-[#E3F2FD] text-[#1976D2] border-[#90CAF9]';
      case 'program_manager':
        return 'bg-[#F3E5F5] text-[#7B1FA2] border-[#CE93D8]';
      default:
        return 'bg-[#F5F5F5] text-[#666666] border-[#D0D0D0]';
    }
  };

  const RoleIcon = getRoleIcon(user.role);
  const roleName = user.role === 'program_manager' ? 'Program Manager' : user.role.charAt(0).toUpperCase() + user.role.slice(1);

  return (
    <div className="bg-white border border-[#E0E0E0] rounded-lg p-4 hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Avatar */}
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#5A5A5A] to-[#3D3D3D] flex items-center justify-center text-white font-semibold text-lg flex-shrink-0">
            {user.displayName?.charAt(0).toUpperCase() || 'U'}
          </div>

          {/* User Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <h4 className="font-semibold text-[#2C2C2C] truncate">{user.displayName}</h4>
              
              {/* Role Badge */}
              <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${getRoleBadgeColor(user.role)} flex items-center gap-1 flex-shrink-0`}>
                <RoleIcon className="h-3 w-3" />
                {roleName}
              </span>

              {/* Status Badge */}
              {user.status === 'active' ? (
                <span className="px-2 py-1 rounded-lg text-xs font-medium bg-[#E8F5E9] text-[#66BB6A] border border-[#81C784] flex items-center gap-1 flex-shrink-0">
                  <CheckCircle className="h-3 w-3" />
                  Active
                </span>
              ) : (
                <span className="px-2 py-1 rounded-lg text-xs font-medium bg-[#FFEBEE] text-[#F44336] border border-[#EF9A9A] flex items-center gap-1 flex-shrink-0">
                  <XCircle className="h-3 w-3" />
                  Inactive
                </span>
              )}

              {/* Must Change Password Badge */}
              {user.mustChangePassword && (
                <span className="px-2 py-1 rounded-lg text-xs font-medium bg-[#FFF9E6] text-[#F57C00] border border-[#FFD700] flex-shrink-0">
                  Password Reset Required
                </span>
              )}
            </div>
            
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-sm text-[#666666]">
                <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{user.email}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-[#666666]">
                <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                <span>
                  Invited {user.invitedAt ? new Date(user.invitedAt).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            onClick={() => onEdit(user)}
            variant="outline"
            size="sm"
            className="border-[#D0D0D0] text-[#666666] hover:bg-[#F5F5F5] p-2"
            title="Edit user"
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UserCard;

