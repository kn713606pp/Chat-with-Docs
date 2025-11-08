/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface AddGroupModalProps {
  onAdd: (name: string) => void;
  onClose: () => void;
}

const AddGroupModal: React.FC<AddGroupModalProps> = ({ onAdd, onClose }) => {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus the input field when the modal opens
    inputRef.current?.focus();
  }, []);
  
  const handleAdd = () => {
    if (name.trim()) {
      onAdd(name.trim());
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="bg-[#1E1E1E] rounded-xl shadow-2xl p-6 w-full max-w-sm border border-[rgba(255,255,255,0.1)]"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-[#E2E2E2]">新增群組</h2>
          <button 
            onClick={onClose} 
            className="p-1 text-[#A8ABB4] hover:text-white rounded-md hover:bg-white/10 transition-colors"
            aria-label="關閉"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="mb-4">
          <label htmlFor="group-name" className="block text-sm font-medium text-[#A8ABB4] mb-1">
            群組名稱
          </label>
          <input
            ref={inputRef}
            type="text"
            id="group-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="例如：我的專案文件"
            className="w-full h-9 py-1 px-2.5 border border-[rgba(255,255,255,0.1)] bg-[#2C2C2C] text-[#E2E2E2] placeholder-[#777777] rounded-lg focus:ring-1 focus:ring-white/20 focus:border-white/20 transition-shadow text-sm"
          />
        </div>

        <div className="flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[#A8ABB4] bg-white/[.08] hover:bg-white/[.12] rounded-md transition-colors"
          >
            取消
          </button>
          <button 
            onClick={handleAdd}
            disabled={!name.trim()}
            className="px-4 py-2 text-sm font-medium text-black bg-[#E2E2E2] hover:bg-white rounded-md transition-colors disabled:bg-[#4A4A4A] disabled:text-[#777777]"
          >
            新增
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddGroupModal;