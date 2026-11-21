import React, { useState } from 'react';
import { CheckCircle2, LifeBuoy, X } from 'lucide-react';
import { submitSupportTicketApi } from '../services/api';

interface SupportModalProps {
  open: boolean;
  defaultEmail: string;
  onClose: () => void;
}

export const SupportModal: React.FC<SupportModalProps> = ({
  open,
  defaultEmail,
  onClose,
}) => {
  const [topic, setTopic] = useState('Schedule Conflict Inquiry');
  const [email, setEmail] = useState(defaultEmail || '');
  const [message, setMessage] = useState('');
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!message.trim()) return;
    try {
      const res = await submitSupportTicketApi({ email, topic, message });
      setTicketId(res.ticketId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit ticket.');
    }
  };

  const handleResetAndClose = () => {
    setTicketId(null);
    setError(null);
    setMessage('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Academic Support"
    >
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-[#E6ECEC] p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-[#E4F5F6] text-[#0D4E52] flex items-center justify-center">
              <LifeBuoy className="w-5 h-5" />
            </span>
            <div>
              <h2 className="font-serif font-semibold text-lg text-[#0F1F21]">
                Academic Support
              </h2>
              <p className="text-xs text-[#5A6B6D]">
                Registrar &amp; Timetable Assistance Desk
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetAndClose}
            aria-label="Close support modal"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-[#5A6B6D] hover:bg-[#F1F5F5]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {ticketId ? (
          <div className="py-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#DCF6E8] text-[#1E6B47] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="font-serif font-semibold text-lg text-[#0F1F21]">
              Ticket {ticketId} Logged
            </h3>
            <p className="text-sm text-[#5A6B6D] leading-relaxed">
              We have sent a confirmation to{' '}
              <span className="font-medium text-[#0F1F21]">
                {email || 'your university inbox'}
              </span>
              . Typical response time is under 2 academic hours.
            </p>
            <button
              type="button"
              onClick={handleResetAndClose}
              className="mt-2 w-full h-11 rounded-xl bg-[#0D4E52] text-white text-sm font-semibold hover:bg-[#093B3E] transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p className="text-xs text-[#991B1B] bg-[#FEF2F2] rounded-xl px-3 py-2">
                {error}
              </p>
            )}
            <div>
              <label className="block text-xs font-semibold text-[#0F1F21] mb-1.5">
                Inquiry Category
              </label>
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-[#F3F6F6] border border-[#E2E8E8] text-sm text-[#0F1F21] focus:outline-none focus:ring-2 focus:ring-[#0D4E52]"
              >
                <option>Schedule Conflict Inquiry</option>
                <option>Section Transfer Request</option>
                <option>Instructor Room Equipment Support</option>
                <option>Registration Number Lookup</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F1F21] mb-1.5">
                University Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@lpu.in"
                className="w-full h-11 px-3.5 rounded-xl bg-[#F3F6F6] border border-[#E2E8E8] text-sm text-[#0F1F21] focus:outline-none focus:ring-2 focus:ring-[#0D4E52]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F1F21] mb-1.5">
                Details
              </label>
              <textarea
                required
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your course code, section, or room booking question..."
                className="w-full p-3.5 rounded-xl bg-[#F3F6F6] border border-[#E2E8E8] text-sm text-[#0F1F21] focus:outline-none focus:ring-2 focus:ring-[#0D4E52] resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full h-11 rounded-xl bg-[#0D4E52] text-white text-sm font-semibold hover:bg-[#093B3E] transition-colors"
            >
              Submit Request
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
