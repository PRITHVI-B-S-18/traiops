import React from 'react';
import { Button } from '@/components/ui/button';
import { Mail, RefreshCcw, Clock3 } from 'lucide-react';
import { format } from 'date-fns';

const statusStyles = {
  pending: 'bg-amber-100 text-amber-800 border border-amber-200',
  accepted: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  expired: 'bg-rose-100 text-rose-800 border border-rose-200'
};

const statusLabels = {
  pending: 'Pending',
  accepted: 'Accepted',
  expired: 'Expired'
};

const formatDateTime = (date) => {
  if (!date) return '—';
  try {
    return format(date, "MMM d, yyyy • h:mm a");
  } catch (error) {
    return '—';
  }
};

const InvitationList = ({
  invitations,
  loading = false,
  onResend,
  resendingId = null,
  emptyStateMessage = 'No invitations found.'
}) => {
  if (loading) {
    return (
      <div className="bg-white border border-[#E0E0E0] rounded-lg shadow-sm p-6 space-y-4">
        {[0, 1, 2].map((index) => (
          <div key={index} className="animate-pulse flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <div className="h-4 bg-gray-200 rounded w-1/4" />
              <div className="h-4 bg-gray-200 rounded w-16" />
            </div>
            <div className="flex gap-3 text-xs text-gray-400">
              <div className="h-3 bg-gray-200 rounded w-1/5" />
              <div className="h-3 bg-gray-200 rounded w-1/6" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!invitations?.length) {
    return (
      <div className="bg-white border border-dashed border-[#D0D0D0] rounded-lg shadow-sm p-10 text-center space-y-3">
        <div className="mx-auto h-12 w-12 rounded-full bg-[#F5F5F5] flex items-center justify-center text-[#5A5A5A]">
          <Mail className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-semibold text-[#2C2C2C]">No Invitations Yet</h3>
        <p className="text-sm text-[#666666]">{emptyStateMessage}</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E0E0E0] rounded-lg shadow-sm divide-y divide-[#F0F0F0]">
      {invitations.map((invitation) => {
        const status = invitation.computedStatus || invitation.status || 'pending';
        const badgeClass = statusStyles[status] || 'bg-gray-100 text-gray-600 border-gray-200';
        const badgeLabel = statusLabels[status] || status;

        return (
          <div key={invitation.invitationId} className="p-5 flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold text-[#2C2C2C] truncate">
                  {invitation.displayName || invitation.email}
                </p>
                <span className={`px-2 py-0.5 rounded-md text-xs font-semibold uppercase tracking-wide ${badgeClass}`}>
                  {badgeLabel}
                </span>
                <span className="text-xs font-medium uppercase tracking-wide text-[#888888] bg-[#F5F5F5] px-2 py-1 rounded">
                  {invitation.role?.replace('_', ' ') || '—'}
                </span>
              </div>
              <p className="text-sm text-[#555555] break-all">{invitation.email}</p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-[#777777] mt-2">
                <span className="flex items-center gap-1">
                  <Clock3 className="h-3.5 w-3.5" />
                  Sent {formatDateTime(invitation.invitedAt)}
                </span>
                {invitation.expiresAt && (
                  <span className="flex items-center gap-1 text-[#B35C00]">
                    <Clock3 className="h-3.5 w-3.5" />
                    Expires {formatDateTime(invitation.expiresAt)}
                  </span>
                )}
                {invitation.acceptedAt && (
                  <span className="flex items-center gap-1 text-[#2F855A]">
                    <Clock3 className="h-3.5 w-3.5" />
                    Accepted {formatDateTime(invitation.acceptedAt)}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="border-[#D0D0D0] text-[#2C2C2C] hover:bg-[#F5F5F5] flex items-center gap-2"
                onClick={() => onResend?.(invitation)}
                disabled={status !== 'pending' || resendingId === invitation.invitationId}
              >
                <RefreshCcw className={`h-4 w-4 ${resendingId === invitation.invitationId ? 'animate-spin' : ''}`} />
                Resend
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default InvitationList;

