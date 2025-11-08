/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef } from 'react';
import { Plus, Trash2, ChevronDown, X, FileUp, FileText, FolderUp, Folder } from 'lucide-react';
import { URLGroup, LocalContext } from '../types';

interface KnowledgeBaseManagerProps {
  urls: string[];
  onAddUrl: (url: string) => void;
  onRemoveUrl: (url: string) => void;
  maxUrls?: number;
  urlGroups: URLGroup[];
  activeUrlGroupId: string;
  onSetGroupId: (id: string) => void;
  onCloseSidebar?: () => void;
  onOpenAddGroupModal: () => void;
  onRemoveGroup: (groupId: string) => void;
  localContext: LocalContext | null;
  onFileUpload: (file: File) => void;
  onFolderUpload: (files: FileList) => void;
  onLocalContextRemove: () => void;
  isProcessingFiles?: boolean;
}

const KnowledgeBaseManager: React.FC<KnowledgeBaseManagerProps> = ({ 
  urls, 
  onAddUrl, 
  onRemoveUrl, 
  maxUrls = 20,
  urlGroups,
  activeUrlGroupId,
  onSetGroupId,
  onCloseSidebar,
  onOpenAddGroupModal,
  onRemoveGroup,
  localContext,
  onFileUpload,
  onFolderUpload,
  onLocalContextRemove,
  isProcessingFiles = false,
}) => {
  const [currentUrlInput, setCurrentUrlInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const isValidUrl = (urlString: string): boolean => {
    try {
      new URL(urlString);
      return true;
    } catch (e) {
      return false;
    }
  };

  const handleAddUrl = () => {
    if (!currentUrlInput.trim()) {
      setError('URL 不能為空。');
      return;
    }
    if (!isValidUrl(currentUrlInput)) {
      setError('URL 格式無效。請包含 http:// 或 https://');
      return;
    }
    if (urls.length >= maxUrls) {
      setError(`目前群組最多只能新增 ${maxUrls} 個 URL。`);
      return;
    }
    if (urls.includes(currentUrlInput)) {
      setError('此 URL 已新增至目前群組。');
      return;
    }
    onAddUrl(currentUrlInput);
    setCurrentUrlInput('');
    setError(null);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
    if(fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };
  
  const handleFolderSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      onFolderUpload(files);
    }
    if(folderInputRef.current) {
      folderInputRef.current.value = '';
    }
  };


  const activeGroupName = urlGroups.find(g => g.id === activeUrlGroupId)?.name || "Unknown Group";

  return (
    <div className="p-4 bg-[#1E1E1E] shadow-md rounded-xl h-full flex flex-col border border-[rgba(255,255,255,0.05)]">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold text-[#E2E2E2]">知識庫</h2>
        {onCloseSidebar && (
          <button
            onClick={onCloseSidebar}
            className="p-1 text-[#A8ABB4] hover:text-white rounded-md hover:bg-white/10 transition-colors md:hidden"
            aria-label="關閉知識庫"
          >
            <X size={24} />
          </button>
        )}
      </div>
      
      <div className="mb-3">
        <label htmlFor="url-group-select-kb" className="block text-sm font-medium text-[#A8ABB4] mb-1">
          目前 URL 群組
        </label>
        <div className="flex items-center gap-2">
          <div className="relative w-full">
            <select
              id="url-group-select-kb"
              value={activeUrlGroupId}
              onChange={(e) => onSetGroupId(e.target.value)}
              className="w-full py-2 pl-3 pr-8 appearance-none border border-[rgba(255,255,255,0.1)] bg-[#2C2C2C] text-[#E2E2E2] rounded-md focus:ring-1 focus:ring-white/20 focus:border-white/20 text-sm"
            >
              {urlGroups.map(group => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
            <ChevronDown
              className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A8ABB4] pointer-events-none"
              aria-hidden="true"
            />
          </div>
          <button
            onClick={onOpenAddGroupModal}
            className="h-9 w-9 p-1.5 bg-white/[.12] hover:bg-white/20 text-white rounded-md transition-colors flex items-center justify-center flex-shrink-0"
            aria-label="新增群組"
          >
            <Plus size={18} />
          </button>
          <button
            onClick={() => onRemoveGroup(activeUrlGroupId)}
            disabled={urlGroups.length <= 1}
            className="h-9 w-9 p-1.5 bg-white/[.08] hover:bg-[#f87171]/20 text-[#A8ABB4] hover:text-[#f87171] rounded-md transition-colors disabled:bg-[#4A4A4A] disabled:text-[#777777] disabled:hover:bg-[#4A4A4A] disabled:hover:text-[#777777] flex items-center justify-center flex-shrink-0"
            aria-label="刪除目前群組"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      
      <p className="text-sm font-medium text-[#A8ABB4] mb-1">知識庫來源</p>
      <div className="flex items-center gap-2 mb-1">
        <input
          type="url"
          value={currentUrlInput}
          onChange={(e) => setCurrentUrlInput(e.target.value)}
          placeholder="https://docs.example.com"
          className="flex-grow h-8 py-1 px-2.5 border border-[rgba(255,255,255,0.1)] bg-[#2C2C2C] text-[#E2E2E2] placeholder-[#777777] rounded-lg focus:ring-1 focus:ring-white/20 focus:border-white/20 transition-shadow text-sm"
          onKeyPress={(e) => e.key === 'Enter' && handleAddUrl()}
        />
        <button
          onClick={handleAddUrl}
          disabled={urls.length >= maxUrls}
          className="h-8 w-8 p-1.5 bg-white/[.12] hover:bg-white/20 text-white rounded-lg transition-colors disabled:bg-[#4A4A4A] disabled:text-[#777777] flex items-center justify-center flex-shrink-0"
          aria-label="新增 URL"
        >
          <Plus size={16} />
        </button>
         <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept=".txt,.md,.json,.html,.csv,.js,.jsx,.ts,.tsx,.py,.css,.scss,.yaml,.yml,.docx,.pdf"
          />
        <input
            type="file"
            ref={folderInputRef}
            onChange={handleFolderSelect}
            className="hidden"
            // @ts-ignore
            webkitdirectory=""
            directory=""
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={!!localContext || isProcessingFiles}
          className="h-8 w-8 p-1.5 bg-white/[.12] hover:bg-white/20 text-white rounded-lg transition-colors disabled:bg-[#4A4A4A] disabled:text-[#777777] flex items-center justify-center flex-shrink-0"
          aria-label="上傳檔案"
        >
          {isProcessingFiles && !localContext ? 
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> 
              : <FileUp size={16} />
          }
        </button>
        <button
          onClick={() => folderInputRef.current?.click()}
          disabled={!!localContext || isProcessingFiles}
          className="h-8 w-8 p-1.5 bg-white/[.12] hover:bg-white/20 text-white rounded-lg transition-colors disabled:bg-[#4A4A4A] disabled:text-[#777777] flex items-center justify-center flex-shrink-0"
          aria-label="上傳資料夾"
        >
          {isProcessingFiles && !localContext ? 
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> 
              : <FolderUp size={16} />
          }
        </button>
      </div>
      {error && <p className="text-xs text-[#f87171] mb-2">{error}</p>}
      
      {localContext && (
        <div className="flex items-center justify-between p-2.5 bg-[#2C2C2C] border border-[rgba(255,255,255,0.05)] rounded-lg mb-2">
          <div className="flex items-center gap-2 truncate">
            {localContext.type === 'file' ? 
                <FileText size={16} className="text-[#A8ABB4] flex-shrink-0" /> : 
                <Folder size={16} className="text-[#A8ABB4] flex-shrink-0" />
            }
            <span className="text-xs text-white truncate" title={localContext.name}>
              {localContext.name} {localContext.type === 'folder' && `(${localContext.count} 個檔案)`}
            </span>
          </div>
          <button
            onClick={onLocalContextRemove}
            className="p-1 text-[#A8ABB4] hover:text-[#f87171] rounded-md hover:bg-[rgba(255,0,0,0.1)] transition-colors flex-shrink-0 ml-2"
            aria-label={`移除 ${localContext.type === 'file' ? '檔案' : '資料夾'} ${localContext.name}`}
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}

      {urls.length >= maxUrls && <p className="text-xs text-[#fbbf24] mb-2">此群組已達到 {maxUrls} 個 URL 的上限。</p>}
      
      <div className="flex-grow overflow-y-auto space-y-2 chat-container">
        {urls.length === 0 && !localContext && (
          <p className="text-[#777777] text-center py-3 text-sm">請將文件 URL 新增至「{activeGroupName}」群組，或上傳檔案/資料夾以開始查詢。</p>
        )}
        {urls.map((url) => (
          <div key={url} className="flex items-center justify-between p-2.5 bg-[#2C2C2C] border border-[rgba(255,255,255,0.05)] rounded-lg hover:shadow-sm transition-shadow">
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#79B8FF] hover:underline truncate" title={url}>
              {url}
            </a>
            <button 
              onClick={() => onRemoveUrl(url)}
              className="p-1 text-[#A8ABB4] hover:text-[#f87171] rounded-md hover:bg-[rgba(255,0,0,0.1)] transition-colors flex-shrink-0 ml-2"
              aria-label={`移除 ${url}`}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KnowledgeBaseManager;