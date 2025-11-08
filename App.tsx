/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useCallback } from 'react';
import { ChatMessage, MessageSender, URLGroup, LocalContext } from './types';
import { generateContentWithUrlContext, getInitialSuggestions } from './services/geminiService';
import { processFolder, ALLOWED_EXTENSIONS, readDocxFile, readPdfFile, readTextFile, MAX_CONTEXT_CHARS } from './services/fileProcessor';
import KnowledgeBaseManager from './components/KnowledgeBaseManager';
import ChatInterface from './components/ChatInterface';
import AddGroupModal from './components/AddGroupModal';

const GEMINI_DOCS_URLS = [
  "https://ai.google.dev/gemini-api/docs",
  "https://ai.google.dev/gemini-api/docs/quickstart",
  "https://ai.google.dev/gemini-api/docs/api-key",
  "https://ai.google.dev/gemini-api/docs/libraries",
  "https://ai.google.dev/gemini-api/docs/models",
  "https://ai.google.dev/gemini-api/docs/pricing",
  "https://ai.google.dev/gemini-api/docs/rate-limits",
  "https://ai.google.dev/gemini-api/docs/billing",
  "https://ai.google.dev/gemini-api/docs/changelog",
];

const MODEL_CAPABILITIES_URLS = [
  "https://ai.google.dev/gemini-api/docs/text-generation",
  "https://ai.google.dev/gemini-api/docs/image-generation",
  "https://ai.google.dev/gemini-api/docs/video",
  "https://ai.google.dev/gemini-api/docs/speech-generation",
  "https://ai.google.dev/gemini-api/docs/music-generation",
  "https://ai.google.dev/gemini-api/docs/long-context",
  "https://ai.google.dev/gemini-api/docs/structured-output",
  "https://ai.google.dev/gemini-api/docs/thinking",
  "https://ai.google.dev/gemini-api/docs/function-calling",
  "https://ai.google.dev/gemini-api/docs/document-processing",
  "https://ai.google.dev/gemini-api/docs/image-understanding",
  "https://ai.google.dev/gemini-api/docs/video-understanding",
  "https://ai.google.dev/gemini-api/docs/audio",
  "https://ai.google.dev/gemini-api/docs/code-execution",
  "https://ai.google.dev/gemini-api/docs/grounding",
];

const INITIAL_URL_GROUPS: URLGroup[] = [
  { id: 'gemini-overview', name: 'Gemini 文件總覽', urls: GEMINI_DOCS_URLS },
  { id: 'model-capabilities', name: '模型功能', urls: MODEL_CAPABILITIES_URLS },
];

const App: React.FC = () => {
  const [urlGroups, setUrlGroups] = useState<URLGroup[]>(INITIAL_URL_GROUPS);
  const [activeUrlGroupId, setActiveUrlGroupId] = useState<string>(INITIAL_URL_GROUPS[0].id);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAddGroupModalOpen, setIsAddGroupModalOpen] = useState(false);
  
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [initialQuerySuggestions, setInitialQuerySuggestions] = useState<string[]>([]);
  
  const [localContext, setLocalContext] = useState<LocalContext | null>(null);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);

  const MAX_URLS = 50;

  const activeGroup = urlGroups.find(group => group.id === activeUrlGroupId);
  const currentUrlsForChat = activeGroup ? activeGroup.urls : [];

   useEffect(() => {
    const apiKey = process.env.API_KEY;
    const currentActiveGroup = urlGroups.find(group => group.id === activeUrlGroupId);
    const welcomeMessageText = !apiKey 
        ? '錯誤：Gemini API 金鑰 (process.env.API_KEY) 尚未設定。請設定此環境變數以使用本應用程式。'
        : `歡迎使用文件瀏覽器！您目前正在瀏覽的內容來自：「${currentActiveGroup?.name || '無'}」。請直接向我提問，或嘗試下方的建議問題開始。`;
    
    setLocalContext(null);

    setChatMessages([{
      id: `system-welcome-${activeUrlGroupId}-${Date.now()}`,
      text: welcomeMessageText,
      sender: MessageSender.SYSTEM,
      timestamp: new Date(),
    }]);
  }, [activeUrlGroupId, urlGroups]); 


  const fetchAndSetInitialSuggestions = useCallback(async (currentUrls: string[]) => {
    if (currentUrls.length === 0) {
      setInitialQuerySuggestions([]);
      return;
    }
      
    setIsFetchingSuggestions(true);
    setInitialQuerySuggestions([]); 

    try {
      const response = await getInitialSuggestions(currentUrls); 
      let suggestionsArray: string[] = [];
      if (response.text) {
        try {
          let jsonStr = response.text.trim();
          const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s; 
          const match = jsonStr.match(fenceRegex);
          if (match && match[2]) {
            jsonStr = match[2].trim();
          }
          const parsed = JSON.parse(jsonStr);
          if (parsed && Array.isArray(parsed.suggestions)) {
            suggestionsArray = parsed.suggestions.filter((s: unknown) => typeof s === 'string');
          } else {
            console.warn("Parsed suggestions response, but 'suggestions' array not found or invalid:", parsed);
             setChatMessages(prev => [...prev, { id: `sys-err-suggestion-fmt-${Date.now()}`, text: "收到的建議格式有誤。", sender: MessageSender.SYSTEM, timestamp: new Date() }]);
          }
        } catch (parseError) {
          console.error("Failed to parse suggestions JSON:", parseError, "Raw text:", response.text);
          setChatMessages(prev => [...prev, { id: `sys-err-suggestion-parse-${Date.now()}`, text: "解析 AI 建議時發生錯誤。", sender: MessageSender.SYSTEM, timestamp: new Date() }]);
        }
      }
      setInitialQuerySuggestions(suggestionsArray.slice(0, 4)); 
    } catch (e: any) {
      const errorMessage = e.message || '無法擷取初始建議。';
      setChatMessages(prev => [...prev, { id: `sys-err-suggestion-fetch-${Date.now()}`, text: `擷取建議時發生錯誤： ${errorMessage}`, sender: MessageSender.SYSTEM, timestamp: new Date() }]);
    } finally {
      setIsFetchingSuggestions(false);
    }
  }, []); 

  useEffect(() => {
    if (currentUrlsForChat.length > 0 && process.env.API_KEY) { 
        fetchAndSetInitialSuggestions(currentUrlsForChat);
    } else {
        setInitialQuerySuggestions([]); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUrlsForChat, fetchAndSetInitialSuggestions]); 


  const handleAddUrl = (url: string) => {
    setUrlGroups(prevGroups => 
      prevGroups.map(group => {
        if (group.id === activeUrlGroupId) {
          if (group.urls.length < MAX_URLS && !group.urls.includes(url)) {
            return { ...group, urls: [...group.urls, url] };
          }
        }
        return group;
      })
    );
  };

  const handleRemoveUrl = (urlToRemove: string) => {
    setUrlGroups(prevGroups =>
      prevGroups.map(group => {
        if (group.id === activeUrlGroupId) {
          return { ...group, urls: group.urls.filter(url => url !== urlToRemove) };
        }
        return group;
      })
    );
  };

  const handleAddGroup = (name: string) => {
    if (!name.trim() || urlGroups.some(g => g.name === name.trim())) {
      alert('群組名稱不能為空或與現有群組重複。');
      return;
    }
    const newGroup: URLGroup = {
      id: `group-${Date.now()}`,
      name: name.trim(),
      urls: [],
    };
    setUrlGroups(prev => [...prev, newGroup]);
    setActiveUrlGroupId(newGroup.id);
    setIsAddGroupModalOpen(false);
  };

  const handleRemoveGroup = (groupId: string) => {
    if (urlGroups.length <= 1) {
      alert('無法刪除最後一個群組。');
      return;
    }
    const groupToRemove = urlGroups.find(g => g.id === groupId);
    if (window.confirm(`您確定要刪除「${groupToRemove?.name}」群組嗎？此操作無法復原。`)) {
      const newGroups = urlGroups.filter(g => g.id !== groupId);
      setUrlGroups(newGroups);
      if (activeUrlGroupId === groupId) {
        setActiveUrlGroupId(newGroups[0].id); 
      }
    }
  };
  
  const handleFileUpload = (file: File) => {
    const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      setChatMessages(prev => [...prev, {
        id: `sys-file-error-type-${Date.now()}`,
        text: `不支援的檔案類型：「${file.name}」。`,
        sender: MessageSender.SYSTEM,
        timestamp: new Date()
      }]);
      return;
    }

    setIsProcessingFiles(true);
    let contentPromise: Promise<string>;

    if (extension === '.docx') {
      contentPromise = readDocxFile(file);
    } else if (extension === '.pdf') {
      contentPromise = readPdfFile(file);
    } else {
      contentPromise = readTextFile(file);
    }

    contentPromise.then(content => {
      let finalContent = content;
      let wasTruncated = false;
      if (content.length > MAX_CONTEXT_CHARS) {
        finalContent = content.substring(0, MAX_CONTEXT_CHARS);
        wasTruncated = true;
      }
      setLocalContext({ type: 'file', name: file.name, content: finalContent, count: 1 });

      let systemMessage = `已成功讀取檔案：「${file.name}」。其內容將會作為提問的上下文。`;
      if (wasTruncated) {
          systemMessage += `\n\n注意：檔案內容因過長已被截斷。`;
      }
      setChatMessages(prev => [...prev, {
        id: `sys-file-upload-${Date.now()}`,
        text: systemMessage,
        sender: MessageSender.SYSTEM,
        timestamp: new Date()
      }]);
    }).catch(error => {
      console.error(`Error reading file ${file.name}:`, error);
      setChatMessages(prev => [...prev, {
        id: `sys-file-error-read-${Date.now()}`,
        text: `讀取檔案「${file.name}」時發生錯誤。`,
        sender: MessageSender.SYSTEM,
        timestamp: new Date()
      }]);
    }).finally(() => {
      setIsProcessingFiles(false);
    });
  };


  const handleFolderUpload = (files: FileList) => {
    const folderName = files[0]?.webkitRelativePath.split('/')[0] || '上傳的資料夾';
    
    setIsProcessingFiles(true);
    setChatMessages(prev => [...prev, {
      id: `sys-folder-processing-${Date.now()}`,
      text: `正在處理資料夾「${folderName}」中的檔案...`,
      sender: MessageSender.SYSTEM,
      timestamp: new Date()
    }]);

    processFolder(files).then(({ fullContent, processedCount, totalValidFileCount }) => {
      if (processedCount === 0) {
        setChatMessages(prev => [...prev, {
          id: `sys-folder-empty-${Date.now()}`,
          text: `在「${folderName}」資料夾中找不到可讀取的檔案。支援的格式為：${ALLOWED_EXTENSIONS.join(', ')}`,
          sender: MessageSender.SYSTEM,
          timestamp: new Date()
        }]);
        return;
      }

      setLocalContext({
        type: 'folder',
        name: folderName,
        content: fullContent,
        count: processedCount
      });

      let systemMessage = `已成功從「${folderName}」資料夾讀取 ${processedCount} 個檔案。其內容將會作為提問的上下文。`;
      if (processedCount < totalValidFileCount) {
        systemMessage += `\n\n注意：因超出總長度限制，有 ${totalValidFileCount - processedCount} 個檔案未被載入。`;
      }
      setChatMessages(prev => [...prev, {
        id: `sys-folder-upload-${Date.now()}`,
        text: systemMessage,
        sender: MessageSender.SYSTEM,
        timestamp: new Date()
      }]);

    }).catch(error => {
      console.error("Error processing folder:", error);
      setChatMessages(prev => [...prev, {
        id: `sys-folder-error-${Date.now()}`,
        text: `處理資料夾時發生錯誤。請檢查主控台以了解詳情。`,
        sender: MessageSender.SYSTEM,
        timestamp: new Date()
      }]);
    }).finally(() => {
        setIsProcessingFiles(false);
    });
  };


  const handleLocalContextRemove = () => {
    const contextName = localContext?.name;
    setLocalContext(null);
     setChatMessages(prev => [...prev, {
        id: `sys-context-remove-${Date.now()}`,
        text: `已移除本機上下文：「${contextName}」。`,
        sender: MessageSender.SYSTEM,
        timestamp: new Date()
      }]);
  };


  const handleSendMessage = async (query: string) => {
    if (!query.trim() || isLoading || isFetchingSuggestions) return;

    const apiKey = process.env.API_KEY;
    if (!apiKey) {
       setChatMessages(prev => [...prev, {
        id: `error-apikey-${Date.now()}`,
        text: '錯誤：API 金鑰 (process.env.API_KEY) 尚未設定。請先設定才能傳送訊息。',
        sender: MessageSender.SYSTEM,
        timestamp: new Date(),
      }]);
      return;
    }
    
    setIsLoading(true);
    setInitialQuerySuggestions([]); 

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      text: query,
      sender: MessageSender.USER,
      timestamp: new Date(),
    };
    
    const modelPlaceholderMessage: ChatMessage = {
      id: `model-response-${Date.now()}`,
      text: '思考中...', 
      sender: MessageSender.MODEL,
      timestamp: new Date(),
      isLoading: true,
    };

    setChatMessages(prevMessages => [...prevMessages, userMessage, modelPlaceholderMessage]);

    try {
      const response = await generateContentWithUrlContext(query, currentUrlsForChat, localContext?.content);
      setChatMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === modelPlaceholderMessage.id
            ? { ...modelPlaceholderMessage, text: response.text || "我收到了空的回應。", isLoading: false, urlContext: response.urlContextMetadata }
            : msg
        )
      );
    } catch (e: any) {
      const errorMessage = e.message || '無法從 AI 取得回應。';
      setChatMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === modelPlaceholderMessage.id
            ? { ...modelPlaceholderMessage, text: `錯誤： ${errorMessage}`, sender: MessageSender.SYSTEM, isLoading: false } 
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestedQueryClick = (query: string) => {
    handleSendMessage(query);
  };
  
  const getChatPlaceholder = () => {
    const hasUrls = currentUrlsForChat.length > 0;
    const hasLocalContext = !!localContext;

    if (!hasUrls && !hasLocalContext) {
      return "請選擇一個群組並/或新增 URL 到知識庫以啟用聊天功能。";
    }

    let contextParts = [];
    if (hasUrls) {
       contextParts.push(`「${activeGroup?.name || '目前文件'}」`);
    }
    if (hasLocalContext) {
      if(localContext.type === 'file') {
        contextParts.push(`檔案「${localContext.name}」`);
      } else {
        // Fix: Changed local to localContext to fix reference error.
        contextParts.push(`資料夾「${localContext.name}」`);
      }
    }
    
    return `針對 ${contextParts.join(' 及 ')} 提問...`;
  }

  return (
    <div 
      className="h-screen max-h-screen antialiased relative overflow-x-hidden bg-[#121212] text-[#E2E2E2]"
    >
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      
      {isAddGroupModalOpen && (
        <AddGroupModal
          onAdd={handleAddGroup}
          onClose={() => setIsAddGroupModalOpen(false)}
        />
      )}

      <div className="flex h-full w-full md:p-4 md:gap-4">
        <div className={`
          fixed top-0 left-0 h-full w-11/12 max-w-sm z-30 transform transition-transform ease-in-out duration-300 p-3
          md:static md:p-0 md:w-1/3 lg:w-1/4 md:h-full md:max-w-none md:translate-x-0 md:z-auto
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <KnowledgeBaseManager
            urls={currentUrlsForChat}
            onAddUrl={handleAddUrl}
            onRemoveUrl={handleRemoveUrl}
            maxUrls={MAX_URLS}
            urlGroups={urlGroups}
            activeUrlGroupId={activeUrlGroupId}
            onSetGroupId={setActiveUrlGroupId}
            onCloseSidebar={() => setIsSidebarOpen(false)}
            onOpenAddGroupModal={() => setIsAddGroupModalOpen(true)}
            onRemoveGroup={handleRemoveGroup}
            localContext={localContext}
            onFileUpload={handleFileUpload}
            onFolderUpload={handleFolderUpload}
            onLocalContextRemove={handleLocalContextRemove}
            isProcessingFiles={isProcessingFiles}
          />
        </div>

        <div className="w-full h-full p-3 md:p-0 md:w-2/3 lg:w-3/4">
          <ChatInterface
            messages={chatMessages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            placeholderText={getChatPlaceholder()}
            initialQuerySuggestions={initialQuerySuggestions}
            onSuggestedQueryClick={handleSuggestedQueryClick}
            isFetchingSuggestions={isFetchingSuggestions}
            onToggleSidebar={() => setIsSidebarOpen(true)}
          />
        </div>
      </div>
    </div>
  );
};

export default App;
